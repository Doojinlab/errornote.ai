import { describe, it, expect } from 'vitest'
import { gradeQuiz, isComplete, isGradableItem, formatElapsed, type QuizItem } from './hsk-quiz'

function item(answer: string, options = ['a', 'b', 'c', 'd']): QuizItem {
  return { kind: 'reading', instructions: '', question: 'q', options, answer, explanation: '' }
}

describe('gradeQuiz()', () => {
  it('정답 수·점수·오답 인덱스 계산', () => {
    const items = [item('a'), item('b'), item('c')]
    const r = gradeQuiz(items, { 0: 'a', 1: 'x', 2: 'c' })
    expect(r).toEqual({ total: 3, correct: 2, score: 67, wrongIndexes: [1] })
  })

  it('미응답은 오답 처리', () => {
    const items = [item('a'), item('b')]
    const r = gradeQuiz(items, { 0: 'a' })
    expect(r.correct).toBe(1)
    expect(r.wrongIndexes).toEqual([1])
  })

  it('빈 세트는 0점', () => {
    expect(gradeQuiz([], {})).toEqual({ total: 0, correct: 0, score: 0, wrongIndexes: [] })
  })
})

describe('isComplete()', () => {
  it('모든 문항 응답 시 true', () => {
    const items = [item('a'), item('b')]
    expect(isComplete(items, { 0: 'a', 1: 'b' })).toBe(true)
    expect(isComplete(items, { 0: 'a' })).toBe(false)
    expect(isComplete([], {})).toBe(false)
  })
})

describe('isGradableItem()', () => {
  it('보기 2개 이상 + 정답이 보기 안', () => {
    expect(isGradableItem(item('a'))).toBe(true)
    expect(isGradableItem(item('z'))).toBe(false) // 정답이 보기에 없음
    expect(isGradableItem(item('a', ['a']))).toBe(false) // 보기 1개
  })
})

describe('formatElapsed()', () => {
  it('분·초 포맷', () => {
    expect(formatElapsed(5000)).toBe('5초')
    expect(formatElapsed(65000)).toBe('1분 5초')
    expect(formatElapsed(0)).toBe('0초')
  })
})
