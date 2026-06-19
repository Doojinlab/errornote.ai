import { describe, it, expect } from 'vitest'
import {
  companionStage,
  nextStageThreshold,
  companionEmoji,
  COMPANION_THRESHOLDS
} from './companion'

describe('companionStage()', () => {
  it('mastery 0 → 1단계', () => {
    expect(companionStage(0)).toBe(1)
  })

  it('임계 직전(2) → 1단계 유지', () => {
    expect(companionStage(2)).toBe(1)
  })

  it('임계 정확히 도달(3) → 2단계', () => {
    expect(companionStage(3)).toBe(2)
  })

  it('8 → 3단계', () => {
    expect(companionStage(8)).toBe(3)
  })

  it('20 → 4단계', () => {
    expect(companionStage(20)).toBe(4)
  })

  it('초과(9999) → 최종 4단계 유지', () => {
    expect(companionStage(9999)).toBe(4)
  })

  it('음수/NaN → 1단계로 방어', () => {
    expect(companionStage(-5)).toBe(1)
    expect(companionStage(NaN)).toBe(1)
  })

  it('각 임계값에서 단계가 정확히 올라간다', () => {
    COMPANION_THRESHOLDS.forEach((threshold, i) => {
      expect(companionStage(threshold)).toBe(i + 1)
    })
  })
})

describe('nextStageThreshold()', () => {
  it('1단계 → 다음 임계 3', () => {
    expect(nextStageThreshold(1)).toBe(3)
  })

  it('3단계 → 다음 임계 20', () => {
    expect(nextStageThreshold(3)).toBe(20)
  })

  it('최종 4단계 → null', () => {
    expect(nextStageThreshold(4)).toBeNull()
  })
})

describe('companionEmoji()', () => {
  it('단계별 이모지를 반환', () => {
    expect(companionEmoji(1)).toBe('🥚')
    expect(companionEmoji(4)).toBe('🐲')
  })
})
