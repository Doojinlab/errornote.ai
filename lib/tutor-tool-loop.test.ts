import { describe, it, expect, vi } from 'vitest'
import { runToolConversation, MAX_TOOL_ROUNDS } from './tutor-tool-loop'
import type { TutorToolContext } from './tutor-tools'
import type Anthropic from '@anthropic-ai/sdk'

// Anthropic.Message 형태의 최소 객체.
function msg(
  content: Anthropic.ContentBlock[],
  stop_reason: Anthropic.Message['stop_reason']
): Anthropic.Message {
  return {
    id: 'm',
    type: 'message',
    role: 'assistant',
    model: 'claude',
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as Anthropic.Message
}

function textBlock(text: string): Anthropic.ContentBlock {
  return { type: 'text', text } as unknown as Anthropic.ContentBlock
}
function toolUseBlock(id: string, name: string, input: unknown): Anthropic.ContentBlock {
  return { type: 'tool_use', id, name, input } as unknown as Anthropic.ContentBlock
}

// vocabulary insert 성공을 돌려주는 toolCtx.
function fakeCtx(): TutorToolContext {
  const insert = vi.fn().mockReturnValue({ error: null })
  return { supabase: { from: () => ({ insert }) } as unknown, studentId: 's1' } as TutorToolContext
}

// 스크립트된 callModel — 호출마다 다음 응답을 돌려주고, 받은 messages 를 기록한다.
function scriptedModel(responses: Anthropic.Message[]) {
  const seen: Anthropic.MessageParam[][] = []
  let i = 0
  const callModel = vi.fn(async (messages: Anthropic.MessageParam[]) => {
    seen.push(JSON.parse(JSON.stringify(messages)))
    return responses[Math.min(i++, responses.length - 1)]
  })
  return { callModel, seen }
}

describe('runToolConversation', () => {
  it('도구 없이 end_turn 이면 1회 호출 후 텍스트 반환', async () => {
    const { callModel } = scriptedModel([msg([textBlock('안녕하세요')], 'end_turn')])
    const res = await runToolConversation({
      messages: [{ role: 'user', content: '안녕' }],
      callModel,
      toolCtx: fakeCtx(),
    })
    expect(res.rounds).toBe(1)
    expect(res.text).toBe('안녕하세요')
    expect(res.toolResults).toHaveLength(0)
    expect(callModel).toHaveBeenCalledTimes(1)
  })

  it('tool_use 한 번 → 도구 실행 + tool_result 재호출 → 최종 텍스트', async () => {
    const { callModel, seen } = scriptedModel([
      msg([textBlock('저장할게요'), toolUseBlock('tu1', 'add_to_vocab', { chinese: '把' })], 'tool_use'),
      msg([textBlock('단어장에 추가했어요')], 'end_turn'),
    ])
    const res = await runToolConversation({
      messages: [{ role: 'user', content: '把 저장해줘' }],
      callModel,
      toolCtx: fakeCtx(),
    })
    expect(res.rounds).toBe(2)
    expect(res.text).toBe('단어장에 추가했어요')
    expect(res.toolResults).toHaveLength(1)
    expect(res.toolResults[0].name).toBe('add_to_vocab')
    expect(res.toolResults[0].result.content).toContain('把')
    expect(res.toolResults[0].result.isError).toBeUndefined()

    // 두 번째 호출 messages 에 tool_result 블록이 포함되어야 한다.
    const secondCall = seen[1]
    const lastMsg = secondCall[secondCall.length - 1]
    const blocks = lastMsg.content as Array<{ type: string; tool_use_id?: string }>
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks.some((b) => b.type === 'tool_result' && b.tool_use_id === 'tu1')).toBe(true)
  })

  it('잘못된 도구 입력은 isError tool_result 로 전달되어도 루프가 계속된다', async () => {
    const { callModel } = scriptedModel([
      msg([toolUseBlock('tu1', 'add_to_vocab', {})], 'tool_use'), // chinese 누락 → isError
      msg([textBlock('입력을 확인해주세요')], 'end_turn'),
    ])
    const res = await runToolConversation({
      messages: [{ role: 'user', content: 'x' }],
      callModel,
      toolCtx: fakeCtx(),
    })
    expect(res.toolResults[0].result.isError).toBe(true)
    expect(res.text).toBe('입력을 확인해주세요')
  })

  it('계속 tool_use 면 maxRounds 에서 멈춘다(무한루프 방지)', async () => {
    const { callModel } = scriptedModel([
      msg([toolUseBlock('t', 'generate_quiz', { questions: [{ prompt: 'p', options: ['a', 'b'], answer_index: 0 }] })], 'tool_use'),
    ])
    const res = await runToolConversation({
      messages: [{ role: 'user', content: 'quiz' }],
      callModel,
      toolCtx: fakeCtx(),
      maxRounds: 2,
    })
    expect(res.rounds).toBe(2)
    expect(callModel).toHaveBeenCalledTimes(2)
  })

  it('MAX_TOOL_ROUNDS 기본값이 존재한다', () => {
    expect(MAX_TOOL_ROUNDS).toBeGreaterThanOrEqual(2)
  })
})
