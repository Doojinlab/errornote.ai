import { describe, it, expect, vi, beforeEach } from 'vitest'

const dispatchSpy = vi.fn()
vi.mock('./ai/dispatch', () => ({
  dispatchJSON: vi.fn((task: string, opts: unknown, parse: (raw: string) => unknown) => {
    dispatchSpy(task, opts)
    return Promise.resolve(parse(MOCK_RAW))
  })
}))

import {
  buildNaturalnessUserPrompt,
  parseNaturalness,
  askNaturalness
} from './quick-ask'

let MOCK_RAW = '{}'

beforeEach(() => {
  dispatchSpy.mockClear()
  MOCK_RAW = JSON.stringify({
    score: 82,
    verdict: 'awkward',
    suggestion: '我觉得有点累。',
    note: '거의 자연스러워요! 살짝만 다듬으면 좋아요.'
  })
})

describe('buildNaturalnessUserPrompt()', () => {
  it('문장을 따옴표로 감싸 포함', () => {
    expect(buildNaturalnessUserPrompt('我很累')).toContain('"我很累"')
  })
})

describe('parseNaturalness()', () => {
  it('정상 파싱', () => {
    const r = parseNaturalness(MOCK_RAW)
    expect(r).toEqual({
      score: 82,
      verdict: 'awkward',
      suggestion: '我觉得有点累。',
      note: '거의 자연스러워요! 살짝만 다듬으면 좋아요.'
    })
  })
  it('score 0~100 클램프', () => {
    expect(parseNaturalness('{"score":150,"verdict":"natural"}').score).toBe(100)
    expect(parseNaturalness('{"score":-5,"verdict":"natural"}').score).toBe(0)
    expect(parseNaturalness('{"score":"oops","verdict":"natural"}').score).toBe(0)
  })
  it('알 수 없는 verdict 는 natural 로 정규화', () => {
    expect(parseNaturalness('{"score":90,"verdict":"weird"}').verdict).toBe('natural')
    expect(parseNaturalness('{"score":10,"verdict":"INCORRECT"}').verdict).toBe('incorrect')
  })
})

describe('askNaturalness()', () => {
  it('빈 문장 → 에러(dispatch 미호출)', async () => {
    await expect(askNaturalness('   ')).rejects.toThrow(/빈 문장/)
    expect(dispatchSpy).not.toHaveBeenCalled()
  })
  it('naturalness-check 태스크로 dispatch + 파싱 결과 반환', async () => {
    const r = await askNaturalness('我很累')
    expect(r.verdict).toBe('awkward')
    expect(dispatchSpy).toHaveBeenCalledWith('naturalness-check', expect.objectContaining({
      maxTokens: 600
    }))
  })
})
