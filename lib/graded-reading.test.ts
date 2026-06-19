import { describe, it, expect, vi, beforeEach } from 'vitest'

const dispatchSpy = vi.fn()
// dispatchJSON 을 모킹: 전달된 parse 를 canned raw 에 적용(실제 parse 로직도 검증)
vi.mock('./ai/dispatch', () => ({
  dispatchJSON: vi.fn((task: string, opts: unknown, parse: (raw: string) => unknown) => {
    dispatchSpy(task, opts)
    return Promise.resolve(parse(MOCK_RAW))
  })
}))

import {
  clampHskLevel,
  buildGradedReadingUserPrompt,
  parseGradedReading,
  generateGradedReading
} from './graded-reading'

let MOCK_RAW = '{}'

beforeEach(() => {
  dispatchSpy.mockClear()
  MOCK_RAW = JSON.stringify({
    title: '我的一天',
    text: '今天我把作业做完了。',
    target_grammar: [{ point: '把字句', example: '我把作业做完了' }],
    glossary: [{ word: '作业', pinyin: 'zuòyè', ko: '숙제' }],
    questions: [{ q: '他做完什么？', answer: '作业' }]
  })
})

describe('clampHskLevel()', () => {
  it('1~6 범위로 클램프, 비정상은 3', () => {
    expect(clampHskLevel(0)).toBe(1)
    expect(clampHskLevel(7)).toBe(6)
    expect(clampHskLevel(4)).toBe(4)
    expect(clampHskLevel(NaN)).toBe(3)
    expect(clampHskLevel(3.6)).toBe(4)
  })
})

describe('buildGradedReadingUserPrompt()', () => {
  it('약점 목록을 포함하고 HSK 레벨 반영', () => {
    const p = buildGradedReadingUserPrompt(['把字句', '语序'], 4)
    expect(p).toContain('HSK 4급')
    expect(p).toContain('把字句')
    expect(p).toContain('语序')
  })
  it('약점 없으면 기초 문형 안내', () => {
    const p = buildGradedReadingUserPrompt([], 2)
    expect(p).toContain('HSK 2급')
    expect(p).toContain('기초')
  })
})

describe('parseGradedReading()', () => {
  it('정상 JSON 파싱 + camel 매핑', () => {
    const r = parseGradedReading(MOCK_RAW)
    expect(r.title).toBe('我的一天')
    expect(r.targetGrammar[0]).toEqual({ point: '把字句', example: '我把作业做完了' })
    expect(r.glossary[0].word).toBe('作业')
    expect(r.questions[0].answer).toBe('作业')
  })
  it('코드펜스 감싼 응답도 파싱', () => {
    const r = parseGradedReading('```json\n' + MOCK_RAW + '\n```')
    expect(r.text).toBe('今天我把作业做完了。')
  })
  it('본문 없으면 에러', () => {
    expect(() => parseGradedReading('{"title":"x"}')).toThrow(/본문/)
  })
})

describe('generateGradedReading()', () => {
  it('graded-reading 태스크로 dispatch 하고 파싱 결과 반환', async () => {
    const r = await generateGradedReading(['把字句'], 4)
    expect(r.title).toBe('我的一天')
    expect(dispatchSpy).toHaveBeenCalledWith('graded-reading', expect.objectContaining({
      system: expect.stringContaining('简体字')
    }))
  })
})
