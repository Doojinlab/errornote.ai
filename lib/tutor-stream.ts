// AI 튜터 tool_use 스트리밍 루프 (#48 / #75) — runToolConversation(비스트리밍·테스트됨)의
// 스트리밍 형제. 한 HTTP 응답 안에서 텍스트 델타를 흘리면서, 모델이 tool_use 로 턴을 끝내면
// 도구를 실행하고 결과를 대화에 덧붙여 다음 라운드를 이어 스트리밍한다.
//
// 클라이언트로는 NDJSON 이벤트 스트림(application/x-ndjson)을 보낸다. 라인마다 한 이벤트:
//   {"type":"text","delta":"..."}            — 어시스턴트 텍스트 조각
//   {"type":"tool","tool":"generate_quiz",...} — 도구 산출물(퀴즈/단어장) UI 렌더용
//   {"type":"done"}                            — 정상 종료
//   {"type":"error","message":"..."}           — 스트리밍 중 오류
//
// client 를 주입형으로 두어 Anthropic 실제 호출 없이 루프를 단위 테스트한다.

import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, buildSystemBlocks, MODEL_ID, type CacheTier } from './claude'

export type TutorStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; tool: string; data: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string }

/** 이벤트 1건을 NDJSON 라인(JSON + '\n')으로 직렬화(순수). */
export function encodeTutorEvent(e: TutorStreamEvent): string {
  return JSON.stringify(e) + '\n'
}

/** Anthropic MessageStream 중 본 루프가 의존하는 최소 표면(테스트 주입용). */
export interface StreamHandle {
  on(event: 'text', cb: (delta: string) => void): unknown
  finalMessage(): Promise<Anthropic.Message>
}
export interface StreamingClient {
  messages: { stream(params: Anthropic.MessageStreamParams): StreamHandle }
}

/** 도구 실행기: 이름+입력 → tool_result 콘텐츠(+UI 전달용 data). */
export type TutorToolRunner = (
  name: string,
  input: unknown
) => Promise<{ content: string; data?: unknown; isError?: boolean }>

export interface StreamTutorOptions {
  system: string | Anthropic.TextBlockParam[]
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  runTool: TutorToolRunner
  maxTokens?: number
  maxRounds?: number
  cacheSystem?: CacheTier
  thinking?: boolean
  /** 테스트 주입용. 미지정 시 lib/claude 싱글턴 클라이언트 사용. */
  client?: StreamingClient
}

/** tool_use 루프 무한 방지 상한(runToolConversation 과 동일 정책). */
export const MAX_STREAM_TOOL_ROUNDS = 4

/**
 * tool_use 스트리밍 대화 루프. 텍스트 델타와 도구 산출물을 NDJSON 이벤트로 흘리는
 * ReadableStream<Uint8Array> 을 돌려준다(Next.js Route 의 Response body 로 직접 반환 가능).
 */
export function streamTutorConversation(opts: StreamTutorOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const client = opts.client ?? (getAnthropicClient() as unknown as StreamingClient)
  const system = buildSystemBlocks(opts.system, opts.cacheSystem)
  const maxRounds = opts.maxRounds ?? MAX_STREAM_TOOL_ROUNDS

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: TutorStreamEvent) =>
        controller.enqueue(encoder.encode(encodeTutorEvent(e)))
      const messages: Anthropic.MessageParam[] = [...opts.messages]
      try {
        let rounds = 0
        while (rounds < maxRounds) {
          rounds++
          const params: Anthropic.MessageStreamParams = {
            model: MODEL_ID,
            max_tokens: opts.maxTokens ?? 2048,
            system,
            messages,
            tools: opts.tools,
          }
          if (opts.thinking !== false) {
            params.thinking = { type: 'adaptive' }
          }

          const stream = client.messages.stream(params)
          stream.on('text', (delta: string) => emit({ type: 'text', delta }))
          const final = await stream.finalMessage()

          if (final.stop_reason !== 'tool_use') break

          // tool_use 턴 전체(thinking 블록 포함)를 보존해야 다음 호출이 유효하다.
          messages.push({ role: 'assistant', content: final.content })

          const toolUseBlocks = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )
          const resultBlocks: Anthropic.ToolResultBlockParam[] = []
          for (const tu of toolUseBlocks) {
            const r = await opts.runTool(tu.name, tu.input)
            // 성공 + UI 전달 데이터가 있을 때만 도구 이벤트를 보낸다(퀴즈/단어장 렌더).
            if (r.data !== undefined && !r.isError) {
              emit({ type: 'tool', tool: tu.name, data: r.data })
            }
            resultBlocks.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: r.content,
              is_error: r.isError ?? false,
            })
          }
          messages.push({ role: 'user', content: resultBlocks })
        }
        emit({ type: 'done' })
        controller.close()
      } catch (err) {
        emit({ type: 'error', message: err instanceof Error ? err.message : '스트리밍 오류' })
        controller.close()
      }
    },
  })
}
