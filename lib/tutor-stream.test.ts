import { describe, it, expect, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import {
  encodeTutorEvent,
  streamTutorConversation,
  type StreamingClient,
  type TutorStreamEvent,
} from './tutor-stream'

// ── 가짜 스트림 클라이언트 ──────────────────────────────────────────────────────
// 라운드별로 미리 정한 (텍스트 델타들, 최종 메시지) 를 돌려준다.
interface Scripted {
  deltas: string[]
  final: Anthropic.Message
}

// SDK 의 ContentBlock/Message 는 필드가 많아(citations·caller·container 등) 테스트에서 전부
// 채우지 않는다. 루프가 보는 필드(type/text/id/name/input/stop_reason/content)만 두고 캐스팅.
function block(b: unknown): Anthropic.ContentBlock {
  return b as Anthropic.ContentBlock
}

function fakeClient(rounds: Scripted[]): StreamingClient {
  let i = 0
  return {
    messages: {
      stream() {
        const cur = rounds[Math.min(i, rounds.length - 1)]
        i++
        return {
          on(_event: 'text', cb: (d: string) => void) {
            for (const d of cur.deltas) cb(d)
            return this
          },
          async finalMessage() {
            return cur.final
          },
        }
      },
    },
  }
}

function msg(content: unknown[], stop: Anthropic.Message['stop_reason']): Anthropic.Message {
  return {
    id: 'm',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-7',
    content: content.map(block),
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as Anthropic.Message
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<TutorStreamEvent[]> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const events: TutorStreamEvent[] = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
  }
  for (const line of buf.split('\n')) {
    const t = line.trim()
    if (t) events.push(JSON.parse(t) as TutorStreamEvent)
  }
  return events
}

const NOOP_TOOL = vi.fn(async () => ({ content: 'ok' }))

describe('encodeTutorEvent', () => {
  it('이벤트를 NDJSON 라인(JSON + 개행)으로 직렬화한다', () => {
    expect(encodeTutorEvent({ type: 'text', delta: 'a' })).toBe('{"type":"text","delta":"a"}\n')
  })
})

describe('streamTutorConversation', () => {
  it('도구 없이 끝나면 텍스트 델타 + done 만 흘린다', async () => {
    const client = fakeClient([
      { deltas: ['안녕', '하세요'], final: msg([{ type: 'text', text: '안녕하세요' }], 'end_turn') },
    ])
    const events = await drain(
      streamTutorConversation({
        system: 'sys',
        messages: [{ role: 'user', content: '안녕' }],
        tools: [],
        runTool: NOOP_TOOL,
        client,
      }),
    )
    expect(events).toEqual([
      { type: 'text', delta: '안녕' },
      { type: 'text', delta: '하세요' },
      { type: 'done' },
    ])
  })

  it('tool_use 라운드: 도구 실행 + data 가 있으면 tool 이벤트를 흘린다', async () => {
    const toolUse = msg(
      [{ type: 'tool_use', id: 'tu1', name: 'generate_quiz', input: { questions: [] } }],
      'tool_use',
    )
    const finalText = msg([{ type: 'text', text: '풀어보세요' }], 'end_turn')
    const client = fakeClient([
      { deltas: [], final: toolUse },
      { deltas: ['풀어보세요'], final: finalText },
    ])
    const runTool = vi.fn(async () => ({
      content: '2문항 퀴즈를 생성했습니다.',
      data: { topic: '把자문', questions: [{ prompt: 'q', options: ['a', 'b'], answerIndex: 0 }] },
    }))

    const events = await drain(
      streamTutorConversation({
        system: 'sys',
        messages: [{ role: 'user', content: '퀴즈 줘' }],
        tools: [],
        runTool,
        client,
      }),
    )

    expect(runTool).toHaveBeenCalledWith('generate_quiz', { questions: [] })
    expect(events).toContainEqual({
      type: 'tool',
      tool: 'generate_quiz',
      data: { topic: '把자문', questions: [{ prompt: 'q', options: ['a', 'b'], answerIndex: 0 }] },
    })
    expect(events).toContainEqual({ type: 'text', delta: '풀어보세요' })
    expect(events[events.length - 1]).toEqual({ type: 'done' })
  })

  it('isError 도구 결과는 tool 이벤트를 흘리지 않는다(루프는 계속)', async () => {
    const toolUse = msg(
      [{ type: 'tool_use', id: 'tu1', name: 'add_to_vocab', input: {} }],
      'tool_use',
    )
    const client = fakeClient([
      { deltas: [], final: toolUse },
      { deltas: ['끝'], final: msg([{ type: 'text', text: '끝' }], 'end_turn') },
    ])
    const runTool = vi.fn(async () => ({ content: '실패', isError: true }))

    const events = await drain(
      streamTutorConversation({
        system: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        tools: [],
        runTool,
        client,
      }),
    )
    expect(events.some((e) => e.type === 'tool')).toBe(false)
    expect(events[events.length - 1]).toEqual({ type: 'done' })
  })

  it('스트림이 throw 하면 error 이벤트로 감싼다', async () => {
    const client: StreamingClient = {
      messages: {
        stream() {
          return {
            on() {
              return this
            },
            async finalMessage(): Promise<Anthropic.Message> {
              throw new Error('boom')
            },
          }
        },
      },
    }
    const events = await drain(
      streamTutorConversation({
        system: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        tools: [],
        runTool: NOOP_TOOL,
        client,
      }),
    )
    expect(events).toContainEqual({ type: 'error', message: 'boom' })
  })
})
