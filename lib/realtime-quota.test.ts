import { describe, it, expect } from 'vitest'
import {
  evaluateRealtimeQuota,
  UTILIZATION_WARN_PCT,
  CONCURRENT_CLASSES_WARN
} from './realtime-quota'

describe('evaluateRealtimeQuota()', () => {
  it('사용률(%) 계산 — 소수 1자리', () => {
    const r = evaluateRealtimeQuota({ activeSessions: 1, potential: 50, planLimit: 200 })
    expect(r.utilizationPct).toBe(25)
  })

  it('planLimit 0 → 사용률 0, 한도 초과 경보 없음', () => {
    const r = evaluateRealtimeQuota({ activeSessions: 1, potential: 10, planLimit: 0 })
    expect(r.utilizationPct).toBe(0)
    expect(r.warnings.join()).not.toContain('플랜 한도')
  })

  it('사용률 80% 이상 → 경보', () => {
    const r = evaluateRealtimeQuota({ activeSessions: 1, potential: 160, planLimit: 200 })
    expect(r.utilizationPct).toBe(80)
    expect(r.shouldAlert).toBe(true)
    expect(r.warnings.some((w) => w.includes('utilization>=80%'))).toBe(true)
  })

  it('80% 미만 + 세션 적음 → 경보 없음', () => {
    const r = evaluateRealtimeQuota({ activeSessions: 2, potential: 100, planLimit: 200 })
    expect(r.shouldAlert).toBe(false)
    expect(r.warnings).toEqual([])
  })

  it('동시 라이브 클래스 임계 이상 → 경보', () => {
    const r = evaluateRealtimeQuota({
      activeSessions: CONCURRENT_CLASSES_WARN,
      potential: 10,
      planLimit: 200
    })
    expect(r.warnings.some((w) => w.includes('동시에 라이브'))).toBe(true)
  })

  it('잠재 동시연결이 한도 초과 → 경보', () => {
    const r = evaluateRealtimeQuota({ activeSessions: 1, potential: 250, planLimit: 200 })
    expect(r.warnings.some((w) => w.includes('플랜 한도'))).toBe(true)
    // 100% 초과 → utilization 도 80 이상 경보와 함께
    expect(r.shouldAlert).toBe(true)
  })

  it('임계 상수 노출', () => {
    expect(UTILIZATION_WARN_PCT).toBe(80)
    expect(CONCURRENT_CLASSES_WARN).toBe(5)
  })
})
