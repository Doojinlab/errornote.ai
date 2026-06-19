// AI 튜터 tool_use 대화 루프 (#48) — 도구 호출을 처리하는 멀티턴 오케스트레이터.
//
// 모델 호출(callModel)을 주입받아 도구 사용 루프를 돈다:
//   모델 호출 → stop_reason='tool_use' 이면 각 tool_use 블록을 runTutorTool 로 실행 →
//   tool_result 를 대화에 덧붙여 재호출 → 'end_turn' 이면 최종 텍스트 반환.
//
// callModel 을 주입형으로 두어 순수 오케스트레이션만 단위 테스트한다(실제 Claude API 무관).
// 프로덕션 바인딩(Anthropic tools 호출)·스트리밍 챗 연동은 실제 API 런타임 검증이 필요하므로
// 별도(후속)로 둔다 — docs/decisions/ai-tutor-roadmap.md 참조.

import type Anthropic from '@anthropic-ai/sdk'
import { runTutorTool, type TutorToolContext, type TutorToolResult } from './tutor-tools'

/** 대화 메시지 배열을 받아 모델 응답 메시지를 돌려주는 호출자(주입형). */
export type ModelCaller = (messages: Anthropic.MessageParam[]) => Promise<Anthropic.Message>

export interface ToolConversationResult {
  /** 최종(또는 마지막) 어시스턴트 텍스트 */
  text: string
  /** 모델 호출 횟수 */
  rounds: number
  /** 실행된 도구와 결과(순서대로) */
  toolResults: Array<{ name: string; result: TutorToolResult }>
}

/** tool_use 루프 무한 방지 상한. */
export const MAX_TOOL_ROUNDS = 4

function collectText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/**
 * tool_use 대화 루프. callModel 이 tool_use 를 요청하면 도구를 실행하고 결과를 덧붙여
 * 다시 호출한다. end_turn(또는 상한 도달) 시 종료.
 */
export async function runToolConversation(opts: {
  messages: Anthropic.MessageParam[]
  callModel: ModelCaller
  toolCtx: TutorToolContext
  maxRounds?: number
}): Promise<ToolConversationResult> {
  const messages: Anthropic.MessageParam[] = [...opts.messages]
  const toolResults: ToolConversationResult['toolResults'] = []
  const maxRounds = opts.maxRounds ?? MAX_TOOL_ROUNDS
  let rounds = 0
  let text = ''

  while (rounds < maxRounds) {
    rounds++
    const msg = await opts.callModel(messages)
    text = collectText(msg)

    if (msg.stop_reason !== 'tool_use') break

    // 어시스턴트의 tool_use 턴을 대화에 추가
    messages.push({ role: 'assistant', content: msg.content })

    const toolUseBlocks = msg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const resultBlocks: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUseBlocks) {
      const result = await runTutorTool(tu.name, tu.input, opts.toolCtx)
      toolResults.push({ name: tu.name, result })
      resultBlocks.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result.content,
        is_error: result.isError ?? false,
      })
    }
    messages.push({ role: 'user', content: resultBlocks })
  }

  return { text, rounds, toolResults }
}
