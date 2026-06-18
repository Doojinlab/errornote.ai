import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateLevel,
  nextLevelXp,
  addXp,
  updateStreak,
  getSnapshot,
  awardActivityCoins,
  spendActivityCoins,
  awardMasteryPoints,
  LEVEL_THRESHOLDS,
  XP_FOR_DRAFT,
  XP_FOR_REVISION,
  XP_FOR_ZERO_ERROR_REVISION,
  XP_FOR_CORRECT_QUIZ,
  XP_FOR_VOCAB_ADD,
  XP_FOR_STREAK_7
} from './gamification'

// ── mock 외부 의존성 ──────────────────────────────────────────────────────────

// Supabase 체이닝 빌더를 반환하는 헬퍼
function makeChain(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis()
  }
  return chain
}

let mockStatsData: { data: unknown; error: null | { message: string } } = {
  data: null,
  error: null
}
let mockUpdateResult: { error: null | { message: string } } = { error: null }
let mockInsertResult: { error: null | { message: string } } = { error: null }
let mockRpcResult: { data: unknown; error: null | { message: string } } = {
  data: null,
  error: null
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'gamification_stats') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(mockStatsData)
          })
        }),
        insert: vi.fn().mockResolvedValue(mockInsertResult),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockUpdateResult)
        })
      }
    }
    return makeChain({ data: null, error: null })
  }),
  rpc: vi.fn((_fn: string, _args: unknown) => Promise.resolve(mockRpcResult))
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

vi.mock('./kakao', () => ({
  notifyKakaoEvent: vi.fn().mockResolvedValue(undefined)
}))

// ── 순수 함수 테스트 ──────────────────────────────────────────────────────────

describe('XP 상수', () => {
  it('정의된 값이 문서 스펙과 일치한다', () => {
    expect(XP_FOR_DRAFT).toBe(10)
    expect(XP_FOR_REVISION).toBe(20)
    expect(XP_FOR_ZERO_ERROR_REVISION).toBe(50)
    expect(XP_FOR_CORRECT_QUIZ).toBe(5)
    expect(XP_FOR_VOCAB_ADD).toBe(3)
    expect(XP_FOR_STREAK_7).toBe(100)
  })
})

describe('calculateLevel()', () => {
  it('XP 0 → 레벨 1', () => {
    expect(calculateLevel(0)).toBe(1)
  })

  it('XP 499 → 레벨 1 (임계치 미달)', () => {
    expect(calculateLevel(499)).toBe(1)
  })

  it('XP 500 → 레벨 2 (첫 임계치 정확히 도달)', () => {
    expect(calculateLevel(500)).toBe(2)
  })

  it('XP 1999 → 레벨 2', () => {
    expect(calculateLevel(1999)).toBe(2)
  })

  it('XP 2000 → 레벨 3', () => {
    expect(calculateLevel(2000)).toBe(3)
  })

  it('XP 4999 → 레벨 3', () => {
    expect(calculateLevel(4999)).toBe(3)
  })

  it('XP 5000 → 레벨 4 (최고 레벨)', () => {
    expect(calculateLevel(5000)).toBe(4)
  })

  it('XP 99999 → 레벨 4 (초과해도 최고 레벨 유지)', () => {
    expect(calculateLevel(99999)).toBe(4)
  })

  it('LEVEL_THRESHOLDS 배열과 일관성 유지', () => {
    LEVEL_THRESHOLDS.forEach((threshold, i) => {
      if (i === 0) return
      expect(calculateLevel(threshold)).toBe(i + 1)
    })
  })
})

describe('nextLevelXp()', () => {
  it('레벨 1 → 500 (다음 레벨 임계치)', () => {
    expect(nextLevelXp(1)).toBe(500)
  })

  it('레벨 2 → 2000', () => {
    expect(nextLevelXp(2)).toBe(2000)
  })

  it('레벨 3 → 5000', () => {
    expect(nextLevelXp(3)).toBe(5000)
  })

  it('레벨 4(최고) → null (다음 레벨 없음)', () => {
    expect(nextLevelXp(4)).toBeNull()
  })
})

// ── 비동기 함수 테스트 ────────────────────────────────────────────────────────

describe('addXp()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateResult = { error: null }
    mockInsertResult = { error: null }
  })

  it('유효하지 않은 amount(0) → 에러 throw', async () => {
    await expect(addXp('student-1', 0)).rejects.toThrow('addXp amount 가 유효하지 않습니다')
  })

  it('음수 amount → 에러 throw', async () => {
    await expect(addXp('student-1', -10)).rejects.toThrow('addXp amount 가 유효하지 않습니다')
  })

  it('NaN amount → 에러 throw', async () => {
    await expect(addXp('student-1', NaN)).rejects.toThrow('addXp amount 가 유효하지 않습니다')
  })

  it('기존 XP 490 + 20 → XP 510, 레벨 2, levelUp true', async () => {
    mockStatsData = { data: { level: 1, xp: 490, streak_days: 0, last_active_date: null }, error: null }
    const result = await addXp('student-1', 20)
    expect(result.xp).toBe(510)
    expect(result.level).toBe(2)
    expect(result.levelUp).toBe(true)
  })

  it('기존 XP 100 + 10 → 레벨업 없음', async () => {
    mockStatsData = { data: { level: 1, xp: 100, streak_days: 0, last_active_date: null }, error: null }
    const result = await addXp('student-1', 10)
    expect(result.xp).toBe(110)
    expect(result.level).toBe(1)
    expect(result.levelUp).toBe(false)
  })

  it('소수점 amount → floor 처리', async () => {
    mockStatsData = { data: { level: 1, xp: 100, streak_days: 0, last_active_date: null }, error: null }
    const result = await addXp('student-1', 10.9)
    expect(result.xp).toBe(110) // floor(10.9) = 10
  })

  it('신규 유저(data=null) → 초기화 후 XP 부여', async () => {
    mockStatsData = { data: null, error: null }
    const result = await addXp('new-student', 10)
    expect(result.xp).toBe(10)
    expect(result.level).toBe(1)
  })

  it('DB update 실패 → 에러 throw', async () => {
    mockStatsData = { data: { level: 1, xp: 100, streak_days: 0, last_active_date: null }, error: null }
    mockUpdateResult = { error: { message: 'update error' } }
    await expect(addXp('student-1', 10)).rejects.toThrow('gamification_stats update 실패')
  })
})

describe('updateStreak()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateResult = { error: null }
    mockInsertResult = { error: null }
  })

  it('오늘 이미 갱신한 경우 → changed false', async () => {
    // UTC 기준 오늘 날짜 계산
    const utcToday = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-${String(new Date().getUTCDate()).padStart(2, '0')}`
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 3, last_active_date: utcToday }, error: null }
    const result = await updateStreak('student-1')
    expect(result.changed).toBe(false)
    expect(result.streakDays).toBe(3)
    expect(result.reachedStreak7).toBe(false)
  })

  it('어제가 last_active_date → streak +1, changed true', async () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yd = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 5, last_active_date: yd }, error: null }
    const result = await updateStreak('student-1')
    expect(result.changed).toBe(true)
    expect(result.streakDays).toBe(6)
    expect(result.reachedStreak7).toBe(false)
  })

  it('어제가 last_active_date이고 streak 6 → streak 7, reachedStreak7 true', async () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yd = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 6, last_active_date: yd }, error: null }
    const result = await updateStreak('student-1')
    expect(result.streakDays).toBe(7)
    expect(result.reachedStreak7).toBe(true)
  })

  it('2일 이상 공백 → streak 1로 리셋', async () => {
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 10, last_active_date: '2020-01-01' }, error: null }
    const result = await updateStreak('student-1')
    expect(result.streakDays).toBe(1)
    expect(result.changed).toBe(true)
  })

  it('last_active_date null(첫 활동) → streak 1', async () => {
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 0, last_active_date: null }, error: null }
    const result = await updateStreak('student-1')
    expect(result.streakDays).toBe(1)
    expect(result.changed).toBe(true)
  })

  it('DB update 실패 → 에러 throw', async () => {
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 0, last_active_date: '2020-01-01' }, error: null }
    mockUpdateResult = { error: { message: '스트릭 update 실패 mock' } }
    await expect(updateStreak('student-1')).rejects.toThrow('gamification_stats 스트릭 update 실패')
  })
})

describe('getSnapshot()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DB 데이터를 GamificationSnapshot 형태로 반환', async () => {
    mockStatsData = { data: { level: 2, xp: 600, streak_days: 3, last_active_date: '2026-04-20' }, error: null }
    const snap = await getSnapshot('student-1')
    expect(snap.level).toBe(2)
    expect(snap.xp).toBe(600)
    expect(snap.streak_days).toBe(3)
    expect(snap.last_active_date).toBe('2026-04-20')
    expect(snap.next_level_xp).toBe(2000) // 레벨 2 다음은 2000
  })

  it('최고 레벨(4)이면 next_level_xp null', async () => {
    mockStatsData = { data: { level: 4, xp: 9999, streak_days: 1, last_active_date: '2026-04-20' }, error: null }
    const snap = await getSnapshot('student-max')
    expect(snap.next_level_xp).toBeNull()
  })

  it('이중 화폐를 스냅샷에 포함한다', async () => {
    mockStatsData = {
      data: { level: 2, xp: 600, streak_days: 3, last_active_date: '2026-04-20', activity_coins: 80, mastery_points: 4 },
      error: null
    }
    const snap = await getSnapshot('student-1')
    expect(snap.activity_coins).toBe(80)
    expect(snap.mastery_points).toBe(4)
  })

  it('화폐 컬럼이 없는 구 데이터는 0 으로 보정', async () => {
    mockStatsData = { data: { level: 1, xp: 0, streak_days: 0, last_active_date: null }, error: null }
    const snap = await getSnapshot('student-legacy')
    expect(snap.activity_coins).toBe(0)
    expect(snap.mastery_points).toBe(0)
  })
})

// ── 이중 화폐 (award_currency RPC) ────────────────────────────────────────────

describe('awardActivityCoins() / spendActivityCoins() / awardMasteryPoints()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpcResult = { data: [{ activity_coins: 100, mastery_points: 5 }], error: null }
  })

  it('유효하지 않은 amount → 에러 throw', async () => {
    await expect(awardActivityCoins('s1', 0)).rejects.toThrow('awardActivityCoins amount')
    await expect(spendActivityCoins('s1', -1)).rejects.toThrow('spendActivityCoins amount')
    await expect(awardMasteryPoints('s1', NaN)).rejects.toThrow('awardMasteryPoints amount')
  })

  it('적립 → award_currency 를 양의 activity_delta 로 호출하고 잔액 반환', async () => {
    const state = await awardActivityCoins('s1', 50)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('award_currency', {
      p_student_id: 's1',
      p_activity_delta: 50,
      p_mastery_delta: 0
    })
    expect(state).toEqual({ activityCoins: 100, masteryPoints: 5 })
  })

  it('소수점 amount → floor 후 호출', async () => {
    await awardActivityCoins('s1', 50.9)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('award_currency', {
      p_student_id: 's1',
      p_activity_delta: 50,
      p_mastery_delta: 0
    })
  })

  it('소비 → 음의 activity_delta 로 호출', async () => {
    await spendActivityCoins('s1', 30)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('award_currency', {
      p_student_id: 's1',
      p_activity_delta: -30,
      p_mastery_delta: 0
    })
  })

  it('숙련 화폐 → mastery_delta 만 양수, activity_delta 0', async () => {
    await awardMasteryPoints('s1', 3)
    expect(mockSupabase.rpc).toHaveBeenCalledWith('award_currency', {
      p_student_id: 's1',
      p_activity_delta: 0,
      p_mastery_delta: 3
    })
  })

  it('RPC error → 에러 throw', async () => {
    mockRpcResult = { data: null, error: { message: 'rpc boom' } }
    await expect(awardActivityCoins('s1', 10)).rejects.toThrow('award_currency RPC 실패')
  })

  it('빈 결과 → 에러 throw', async () => {
    mockRpcResult = { data: [], error: null }
    await expect(awardActivityCoins('s1', 10)).rejects.toThrow('비어 있습니다')
  })
})
