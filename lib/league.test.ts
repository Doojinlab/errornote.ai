import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  leagueTier,
  weekStartOf,
  addLeaguePoints,
  getLeagueStandings,
  LEAGUE_SILVER_AT,
  LEAGUE_GOLD_AT
} from './league'
import { anonNickname } from './anon'

let mockRpcResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }
const rpcSpy = vi.fn()

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn((fn: string, args: unknown) => {
    rpcSpy(fn, args)
    return Promise.resolve(mockRpcResult)
  })
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

beforeEach(() => {
  mockRpcResult = { data: null, error: null }
  rpcSpy.mockClear()
})

describe('leagueTier()', () => {
  it('임계치 기준 브론즈/실버/골드', () => {
    expect(leagueTier(0)).toBe('bronze')
    expect(leagueTier(LEAGUE_SILVER_AT - 1)).toBe('bronze')
    expect(leagueTier(LEAGUE_SILVER_AT)).toBe('silver')
    expect(leagueTier(LEAGUE_GOLD_AT - 1)).toBe('silver')
    expect(leagueTier(LEAGUE_GOLD_AT)).toBe('gold')
    expect(leagueTier(9999)).toBe('gold')
  })
})

describe('weekStartOf()', () => {
  it('주의 시작은 월요일(UTC)', () => {
    // 2026-06-18 은 목요일 → 그 주 월요일은 2026-06-15
    expect(weekStartOf(new Date('2026-06-18T10:00:00Z'))).toBe('2026-06-15')
    // 월요일 당일
    expect(weekStartOf(new Date('2026-06-15T00:00:00Z'))).toBe('2026-06-15')
    // 일요일은 그 전 주 월요일로
    expect(weekStartOf(new Date('2026-06-21T23:00:00Z'))).toBe('2026-06-15')
  })
})

describe('addLeaguePoints()', () => {
  it('RPC 반환 숫자 그대로 + 인자 전달', async () => {
    mockRpcResult = { data: 140, error: null }
    const pts = await addLeaguePoints('s1', 'c1', 40, '2026-06-15')
    expect(pts).toBe(140)
    expect(rpcSpy).toHaveBeenCalledWith('add_league_points', {
      p_student_id: 's1',
      p_class_id: 'c1',
      p_week_start: '2026-06-15',
      p_points: 40
    })
  })

  it('에러 → throw', async () => {
    mockRpcResult = { data: null, error: { message: 'boom' } }
    await expect(addLeaguePoints('s1', 'c1', 10, '2026-06-15')).rejects.toThrow(/boom/)
  })
})

describe('getLeagueStandings()', () => {
  it('익명 시드→닉네임 + 포인트→티어 매핑', async () => {
    mockRpcResult = {
      data: [
        { rank: 1, points: 320, anon_seed: 'aaaa1111', is_me: false },
        { rank: 2, points: 150, anon_seed: 'bbbb2222', is_me: true },
        { rank: 3, points: 40, anon_seed: 'cccc3333', is_me: false }
      ],
      error: null
    }
    const rows = await getLeagueStandings('c1', '2026-06-15')
    expect(rows[0]).toEqual({
      rank: 1,
      points: 320,
      tier: 'gold',
      nickname: anonNickname('aaaa1111'),
      isMe: false
    })
    expect(rows[1].tier).toBe('silver')
    expect(rows[1].isMe).toBe(true)
    expect(rows[2].tier).toBe('bronze')
    // 실명/student_id 가 노출되지 않는다(닉네임만)
    expect(JSON.stringify(rows)).not.toContain('student_id')
  })

  it('빈 순위 → 빈 배열', async () => {
    mockRpcResult = { data: [], error: null }
    expect(await getLeagueStandings('c1', '2026-06-15')).toEqual([])
  })
})
