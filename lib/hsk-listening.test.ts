import { describe, it, expect, vi, beforeEach } from 'vitest'

const dispatchSpy = vi.fn()
vi.mock('@/lib/ai/dispatch', () => ({
  dispatchJSON: vi.fn((task: string, opts: unknown, parse: (raw: string) => unknown) => {
    dispatchSpy(task, opts)
    return Promise.resolve(parse(MOCK_RAW))
  }),
}))

import { parseHskListening, generateHskListening } from './hsk-listening'

const VALID = JSON.stringify({
  audio_script: '男：你几点下课？女：我三点下课。',
  instructions: '녹음을 듣고 알맞은 답을 고르세요.',
  question: '여자는 몇 시에 수업이 끝나나요?',
  options: ['两点', '三点', '四点', '五点'],
  answer: '三点',
  explanation: '女가 三点下课 라고 답했습니다.',
})

let MOCK_RAW = VALID

beforeEach(() => {
  dispatchSpy.mockClear()
  MOCK_RAW = VALID
})

describe('parseHskListening()', () => {
  it('정상 JSON 파싱 + 필드 매핑', () => {
    const q = parseHskListening(VALID, 4)
    expect(q.level).toBe(4)
    expect(q.audioScript).toContain('三点')
    expect(q.options).toHaveLength(4)
    expect(q.answer).toBe('三点')
  })

  it('코드펜스로 감싼 응답도 파싱', () => {
    const q = parseHskListening('```json\n' + VALID + '\n```', 5)
    expect(q.level).toBe(5)
    expect(q.answer).toBe('三点')
  })

  it('대본(audio_script) 없으면 에러', () => {
    const raw = JSON.stringify({ question: 'q', options: ['a', 'b'], answer: 'a' })
    expect(() => parseHskListening(raw, 3)).toThrow(/대본/)
  })

  it('정답이 보기와 불일치하면 에러', () => {
    const raw = JSON.stringify({
      audio_script: '你好',
      question: 'q',
      options: ['a', 'b', 'c', 'd'],
      answer: 'z',
    })
    expect(() => parseHskListening(raw, 3)).toThrow(/일치/)
  })

  it('보기가 부족하면 에러', () => {
    const raw = JSON.stringify({
      audio_script: '你好',
      question: 'q',
      options: ['a'],
      answer: 'a',
    })
    expect(() => parseHskListening(raw, 3)).toThrow(/보기/)
  })

  it('instructions 누락 시 기본 지시문으로 대체', () => {
    const raw = JSON.stringify({
      audio_script: '你好',
      question: 'q',
      options: ['a', 'b'],
      answer: 'a',
    })
    expect(parseHskListening(raw, 3).instructions).toContain('녹음')
  })
})

describe('generateHskListening()', () => {
  it('hsk-generate 태스크로 dispatch 하고 파싱 결과 반환', async () => {
    const q = await generateHskListening(4)
    expect(q.answer).toBe('三点')
    expect(dispatchSpy).toHaveBeenCalledWith('hsk-generate', expect.objectContaining({
      thinking: false,
    }))
  })
})
