import { describe, it, expect } from 'vitest'
import { normalizeQuizMistake } from './quiz-mistakes'

// normalizeQuizMistake 은 순수 검증/정규화 함수 — DB 없이 단위 테스트한다.
// 핵심 불변식: "오답만 저장한다"(선택=정답이면 null) + 형식 검증.

const base = {
  topic: '量词',
  prompt: '빈칸에 알맞은 양사를 고르세요: 三___书',
  options: ['个', '本', '只'],
  chosenIndex: 0, // 个 (오답)
  answerIndex: 1, // 本 (정답)
  explanation: '책은 本',
  chapterNumber: 3,
}

describe('normalizeQuizMistake()', () => {
  it('유효한 오답 → 정규화된 입력 반환', () => {
    const r = normalizeQuizMistake(base)
    expect(r).not.toBeNull()
    expect(r!.chosenIndex).toBe(0)
    expect(r!.answerIndex).toBe(1)
    expect(r!.options).toEqual(['个', '本', '只'])
    expect(r!.topic).toBe('量词')
    expect(r!.chapterNumber).toBe(3)
  })

  it('정답을 맞힌 경우(선택=정답) → null (오답만 저장)', () => {
    expect(normalizeQuizMistake({ ...base, chosenIndex: 1 })).toBeNull()
  })

  it('보기가 2개 미만 → null', () => {
    expect(normalizeQuizMistake({ ...base, options: ['本'] })).toBeNull()
  })

  it('선택 인덱스 범위 초과 → null', () => {
    expect(normalizeQuizMistake({ ...base, chosenIndex: 9 })).toBeNull()
  })

  it('정답 인덱스 범위 초과 → null', () => {
    expect(normalizeQuizMistake({ ...base, answerIndex: 9 })).toBeNull()
  })

  it('prompt 누락 → null', () => {
    expect(normalizeQuizMistake({ ...base, prompt: '   ' })).toBeNull()
  })

  it('비정수 인덱스 → null', () => {
    expect(normalizeQuizMistake({ ...base, chosenIndex: 0.5 })).toBeNull()
  })

  it('topic/explanation 빈 문자열 → null 필드로 정규화', () => {
    const r = normalizeQuizMistake({ ...base, topic: '  ', explanation: '' })
    expect(r).not.toBeNull()
    expect(r!.topic).toBeNull()
    expect(r!.explanation).toBeNull()
  })

  it('chapterNumber 누락 → null', () => {
    const { chapterNumber: _omit, ...noChapter } = base
    const r = normalizeQuizMistake(noChapter)
    expect(r!.chapterNumber).toBeNull()
  })

  it('객체가 아닌 입력 → null', () => {
    expect(normalizeQuizMistake(null)).toBeNull()
    expect(normalizeQuizMistake('nope')).toBeNull()
    expect(normalizeQuizMistake(undefined)).toBeNull()
  })

  it('options 안의 비문자열 값은 제거 후 검증', () => {
    const r = normalizeQuizMistake({ ...base, options: ['个', '本', 42, null] })
    expect(r).not.toBeNull()
    expect(r!.options).toEqual(['个', '本'])
  })
})
