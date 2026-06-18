import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  grantWeeklyProtector,
  consumeStreakProtector,
  updateStreakWithProtection,
  advanceErrorTypeStreak,
  MAX_STREAK_PROTECTORS,
  STREAK_MILESTONES
} from './streak-economy'

// ── mock 외부 의존성 ──────────────────────────────────────────────────────────

let mockStatsData: { data: unknown; error: null | { message: string } } = {
  data: null,
  error: null
}
let mockUpsertResult: { error: null | { message: string } } = { error: null }
// rpc 결과는 함수명으로 분기
let mockRpcByFn: Record<string, { data: unknown; error: null | { message: string } }> = {}

const upsertSpy = vi.fn()
const rpcSpy = vi.fn()

const mockSupabase = {
  from: vi.fn((_table: string) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(mockStatsData)
      })
    }),
    upsert: vi.fn((...args: unknown[]) => {
      upsertSpy(...args)
      return Promise.resolve(mockUpsertResult)
    })
  })),
  rpc: vi.fn((fn: string, args: unknown) => {
    rpcSpy(fn, args)
    return Promise.resolve(mockRpcByFn[fn] ?? { data: null, error: null })
  })
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

// UTC 기준 오늘 ± offset 일의 YYYY-MM-DD
function ymdOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

beforeEach(() => {
  mockStatsData = { data: null, error: null }
  mockUpsertResult = { error: null }
  mockRpcByFn = {}
  upsertSpy.mockClear()
  rpcSpy.mockClear()
})

// ── 보호권 RPC 래퍼 ───────────────────────────────────────────────────────────

describe('grantWeeklyProtector()', () => {
  it('RPC 결과를 camelCase 로 매핑', async () => {
    mockRpcByFn['grant_weekly_streak_protector'] = {
      data: [{ streak_protectors: 2, granted: true }],
      error: null
    }
    const res = await grantWeeklyProtector('s1')
    expect(res).toEqual({ streakProtectors: 2, granted: true })
    expect(rpcSpy).toHaveBeenCalledWith('grant_weekly_streak_protector', { p_student_id: 's1' })
  })

  it('빈 결과 → 에러', async () => {
    mockRpcByFn['grant_weekly_streak_protector'] = { data: [], error: null }
    await expect(grantWeeklyProtector('s1')).rejects.toThrow(/비어 있습니다/)
  })

  it('RPC 에러 → throw', async () => {
    mockRpcByFn['grant_weekly_streak_protector'] = { data: null, error: { message: 'boom' } }
    await expect(grantWeeklyProtector('s1')).rejects.toThrow(/boom/)
  })
})

describe('consumeStreakProtector()', () => {
  it('RPC 결과 매핑', async () => {
    mockRpcByFn['consume_streak_protector'] = {
      data: [{ streak_protectors: 0, consumed: true }],
      error: null
    }
    const res = await consumeStreakProtector('s1')
    expect(res).toEqual({ streakProtectors: 0, consumed: true })
  })
})

// ── 보호권 적용 스트릭 갱신 ───────────────────────────────────────────────────

describe('updateStreakWithProtection()', () => {
  it('오늘 이미 갱신 → changed=false, 쓰기 없음', async () => {
    mockStatsData = {
      data: { streak_days: 3, last_active_date: ymdOffset(0), streak_protectors: 1, longest_streak: 5 },
      error: null
    }
    const res = await updateStreakWithProtection('s1')
    expect(res.changed).toBe(false)
    expect(res.streakDays).toBe(3)
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('어제 활동(gap=1) → streak +1, 보호권 미사용', async () => {
    mockStatsData = {
      data: { streak_days: 3, last_active_date: ymdOffset(-1), streak_protectors: 2, longest_streak: 3 },
      error: null
    }
    const res = await updateStreakWithProtection('s1')
    expect(res.changed).toBe(true)
    expect(res.streakDays).toBe(4)
    expect(res.protectorUsed).toBe(false)
    expect(res.longestStreak).toBe(4)
    // 보호권 소비 RPC 미호출
    expect(rpcSpy).not.toHaveBeenCalledWith('consume_streak_protector', expect.anything())
  })

  it('하루 결석(gap=2) + 보호권 보유 → 보호권 소비, 연속 유지(+1)', async () => {
    mockStatsData = {
      data: { streak_days: 6, last_active_date: ymdOffset(-2), streak_protectors: 1, longest_streak: 6 },
      error: null
    }
    mockRpcByFn['consume_streak_protector'] = {
      data: [{ streak_protectors: 0, consumed: true }],
      error: null
    }
    const res = await updateStreakWithProtection('s1')
    expect(res.protectorUsed).toBe(true)
    expect(res.streakDays).toBe(7)
    expect(res.reachedStreak7).toBe(true)
    expect(res.milestone).toBe(7)
    expect(rpcSpy).toHaveBeenCalledWith('consume_streak_protector', { p_student_id: 's1' })
  })

  it('하루 결석(gap=2) + 보호권 없음 → 리셋(무벌점)', async () => {
    mockStatsData = {
      data: { streak_days: 9, last_active_date: ymdOffset(-2), streak_protectors: 0, longest_streak: 9 },
      error: null
    }
    const res = await updateStreakWithProtection('s1')
    expect(res.protectorUsed).toBe(false)
    expect(res.streakDays).toBe(1)
    // 최장 기록은 보존
    expect(res.longestStreak).toBe(9)
  })

  it('2일 이상 공백(gap=3) → 보호권 있어도 리셋', async () => {
    mockStatsData = {
      data: { streak_days: 9, last_active_date: ymdOffset(-3), streak_protectors: 2, longest_streak: 9 },
      error: null
    }
    const res = await updateStreakWithProtection('s1')
    expect(res.streakDays).toBe(1)
    expect(res.protectorUsed).toBe(false)
    expect(rpcSpy).not.toHaveBeenCalledWith('consume_streak_protector', expect.anything())
  })

  it('최초(stats 없음) → streak=1', async () => {
    mockStatsData = { data: null, error: null }
    const res = await updateStreakWithProtection('s1')
    expect(res.streakDays).toBe(1)
    expect(res.changed).toBe(true)
    expect(res.longestStreak).toBe(1)
  })

  it('보호권 소비가 동시성으로 실패하면 리셋으로 폴백', async () => {
    mockStatsData = {
      data: { streak_days: 6, last_active_date: ymdOffset(-2), streak_protectors: 1, longest_streak: 6 },
      error: null
    }
    mockRpcByFn['consume_streak_protector'] = {
      data: [{ streak_protectors: 0, consumed: false }],
      error: null
    }
    const res = await updateStreakWithProtection('s1')
    expect(res.protectorUsed).toBe(false)
    expect(res.streakDays).toBe(1)
  })

  it('조회 에러 → throw', async () => {
    mockStatsData = { data: null, error: { message: 'select fail' } }
    await expect(updateStreakWithProtection('s1')).rejects.toThrow(/select fail/)
  })
})

// ── 유형별 무사고 스트릭 ──────────────────────────────────────────────────────

describe('advanceErrorTypeStreak()', () => {
  it('RPC 결과 매핑 + 인자 전달', async () => {
    mockRpcByFn['advance_error_type_streak'] = {
      data: [{ no_error_days: 5, best_days: 12 }],
      error: null
    }
    const res = await advanceErrorTypeStreak('s1', 'ba_construction', false)
    expect(res).toEqual({ noErrorDays: 5, bestDays: 12 })
    expect(rpcSpy).toHaveBeenCalledWith('advance_error_type_streak', {
      p_student_id: 's1',
      p_code: 'ba_construction',
      p_had_error: false
    })
  })

  it('빈 결과 → 에러', async () => {
    mockRpcByFn['advance_error_type_streak'] = { data: [], error: null }
    await expect(advanceErrorTypeStreak('s1', 'word_order', true)).rejects.toThrow(/비어 있습니다/)
  })
})

// ── 상수 ──────────────────────────────────────────────────────────────────────

describe('상수', () => {
  it('보호권 상한 2', () => {
    expect(MAX_STREAK_PROTECTORS).toBe(2)
  })
  it('마일스톤 7/30/100', () => {
    expect(STREAK_MILESTONES).toEqual([7, 30, 100])
  })
})
