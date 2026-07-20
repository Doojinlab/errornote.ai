import { describe, it, expect } from 'vitest'
import {
  isHskArea,
  isHskSessionType,
  isHskGradingMode,
  parseHskSessionParams,
} from './hsk'

describe('isHskArea()', () => {
  it('듣기(listening) 포함', () => {
    expect(isHskArea('listening')).toBe(true)
    expect(isHskArea('reading')).toBe(true)
    expect(isHskArea('writing')).toBe(true)
    expect(isHskArea('speaking')).toBe(true)
    expect(isHskArea('nope')).toBe(false)
  })
})

describe('parseHskSessionParams()', () => {
  it('말하기는 차단(null)', () => {
    expect(
      parseHskSessionParams({ level: '4', area: 'speaking', hskMode: 'practice' }),
    ).toBeNull()
  })

  it('유효하지 않은 급수/영역/모드는 null', () => {
    expect(parseHskSessionParams({ level: '9', area: 'reading', hskMode: 'practice' })).toBeNull()
    expect(parseHskSessionParams({ level: '4', area: 'x', hskMode: 'practice' })).toBeNull()
  })

  it('듣기 연습 — 기본 sessionType=drill, gradingMode=immediate', () => {
    expect(
      parseHskSessionParams({ level: '4', area: 'listening', hskMode: 'practice' }),
    ).toEqual({ level: 4, area: 'listening', mode: 'practice', sessionType: 'drill', gradingMode: 'immediate' })
  })

  it('연습 + 모아서 채점 지정', () => {
    expect(
      parseHskSessionParams({
        level: '5',
        area: 'reading',
        hskMode: 'practice',
        sessionType: 'drill',
        gradingMode: 'batch',
      }),
    ).toMatchObject({ sessionType: 'drill', gradingMode: 'batch' })
  })

  it('실전(exam)은 채점을 batch 로 강제(즉시 지정해도 무시)', () => {
    expect(
      parseHskSessionParams({
        level: '6',
        area: 'reading',
        hskMode: 'practice',
        sessionType: 'exam',
        gradingMode: 'immediate',
      }),
    ).toEqual({ level: 6, area: 'reading', mode: 'practice', sessionType: 'exam', gradingMode: 'batch' })
  })

  it('개념 학습은 sessionType/gradingMode 없음', () => {
    expect(
      parseHskSessionParams({ level: '3', area: 'writing', hskMode: 'concept' }),
    ).toEqual({ level: 3, area: 'writing', mode: 'concept' })
  })
})

describe('type guards', () => {
  it('isHskSessionType / isHskGradingMode', () => {
    expect(isHskSessionType('drill')).toBe(true)
    expect(isHskSessionType('exam')).toBe(true)
    expect(isHskSessionType('x')).toBe(false)
    expect(isHskGradingMode('immediate')).toBe(true)
    expect(isHskGradingMode('batch')).toBe(true)
    expect(isHskGradingMode('x')).toBe(false)
  })
})
