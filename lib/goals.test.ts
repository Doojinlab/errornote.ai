import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadGoalStats,
  calcGoalProgress,
  calcProgressForGoals,
  isValidGoalInput,
  type GoalStats,
} from './goals'
import type { GoalType, LearningGoal } from '@/types/goals'

// ── Supabase 모의 ─────────────────────────────────────────────────────────────
// goals.ts 는 supabase 클라이언트를 인자로 주입받으므로(DI) 모듈 목킹 없이
// 쿼리 형태(table·count·filters)를 받아 응답을 돌려주는 handler 기반 빌더를 넘긴다.
interface QueryShape {
  table: string
  count: boolean
  filters: Array<[string, string, unknown]>
}
type QueryResult = { data?: unknown; error: unknown; count?: number }

let handleQuery: (q: QueryShape) => QueryResult = () => ({ data: [], error: null })

function makeBuilder(table: string) {
  const q: QueryShape = { table, count: false, filters: [] }
  const b: Record<string, unknown> = {
    select: (_cols: string, opts?: { head?: boolean; count?: string }) => {
      if (opts && (opts.head || opts.count)) q.count = true
      return b
    },
    eq: (c: string, v: unknown) => {
      q.filters.push(['eq', c, v])
      return b
    },
    in: (c: string, v: unknown) => {
      q.filters.push(['in', c, v])
      return b
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(handleQuery(q)).then(resolve, reject),
  }
  return b
}

const mockSupabase = { from: (table: string) => makeBuilder(table) }
type Supabase = Parameters<typeof loadGoalStats>[0]
const supa = mockSupabase as unknown as Supabase

function goal(over: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: 'g1',
    student_id: 'u1',
    class_id: 'c1',
    goal_type: 'vocab_count',
    target_value: '100',
    current_value: 0,
    deadline: null,
    is_achieved: false,
    achieved_at: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...over,
  }
}

function emptyStats(): GoalStats {
  return { vocabCount: 0, totalUnresolvedErrors: 0, errorTypeCounts: new Map() }
}

beforeEach(() => {
  handleQuery = () => ({ data: [], error: null })
})

describe('isValidGoalInput', () => {
  it('rejects empty / whitespace target', () => {
    expect(isValidGoalInput('vocab_count', '').ok).toBe(false)
    expect(isValidGoalInput('vocab_count', '   ').ok).toBe(false)
  })

  it('accepts any non-empty subtype for error_type and rejects overly long ones', () => {
    expect(isValidGoalInput('error_type', '把字句오류').ok).toBe(true)
    const long = 'x'.repeat(101)
    const r = isValidGoalInput('error_type', long)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('깁니다')
  })

  it('requires a non-negative integer for numeric goal types', () => {
    expect(isValidGoalInput('vocab_count', '50').ok).toBe(true)
    expect(isValidGoalInput('error_count', '0').ok).toBe(true)
    expect(isValidGoalInput('vocab_count', '-1').ok).toBe(false)
    expect(isValidGoalInput('vocab_count', 'abc').ok).toBe(false)
  })

  it('rejects values above the 100000 ceiling', () => {
    const r = isValidGoalInput('vocab_count', '100001')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('큽니다')
  })
})

describe('calcGoalProgress · vocab_count', () => {
  it('computes percentage and achievement when the target is met', () => {
    const stats: GoalStats = { ...emptyStats(), vocabCount: 120 }
    const p = calcGoalProgress(goal({ goal_type: 'vocab_count', target_value: '100' }), stats)
    expect(p.direction).toBe('increase')
    expect(p.current).toBe(120)
    expect(p.target).toBe(100)
    expect(p.percentage).toBe(100)
    expect(p.isAchieved).toBe(true)
  })

  it('rounds partial progress and stays below 100', () => {
    const stats: GoalStats = { ...emptyStats(), vocabCount: 45 }
    const p = calcGoalProgress(goal({ target_value: '100' }), stats)
    expect(p.percentage).toBe(45)
    expect(p.isAchieved).toBe(false)
  })

  it('treats a zero / invalid target as 0% and not achieved', () => {
    const stats: GoalStats = { ...emptyStats(), vocabCount: 5 }
    expect(calcGoalProgress(goal({ target_value: '0' }), stats).percentage).toBe(0)
    expect(calcGoalProgress(goal({ target_value: 'abc' }), stats).isAchieved).toBe(false)
  })
})

describe('calcGoalProgress · error_count', () => {
  const g = goal({ goal_type: 'error_count', target_value: '5' })

  it('is 100% and achieved when unresolved errors are at or under the target', () => {
    const p = calcGoalProgress(g, { ...emptyStats(), totalUnresolvedErrors: 3 })
    expect(p.direction).toBe('decrease')
    expect(p.percentage).toBe(100)
    expect(p.isAchieved).toBe(true)
  })

  it('scales target/current when over the target', () => {
    const p = calcGoalProgress(g, { ...emptyStats(), totalUnresolvedErrors: 10 })
    expect(p.percentage).toBe(50) // 5/10
    expect(p.isAchieved).toBe(false)
  })

  it('is 0% when the target is 0 but errors remain', () => {
    const p = calcGoalProgress(
      goal({ goal_type: 'error_count', target_value: '0' }),
      { ...emptyStats(), totalUnresolvedErrors: 4 }
    )
    expect(p.percentage).toBe(0)
    expect(p.isAchieved).toBe(false)
  })
})

describe('calcGoalProgress · error_type', () => {
  const g = goal({ goal_type: 'error_type', target_value: '어순' })

  it('reports full progress once every card of the subtype is resolved', () => {
    const stats: GoalStats = {
      ...emptyStats(),
      errorTypeCounts: new Map([['어순', { total: 4, resolved: 4 }]]),
    }
    const p = calcGoalProgress(g, stats)
    expect(p.current).toBe(0)
    expect(p.target).toBe(0)
    expect(p.percentage).toBe(100)
    expect(p.isAchieved).toBe(true)
  })

  it('computes resolved/total ratio while some remain unresolved', () => {
    const stats: GoalStats = {
      ...emptyStats(),
      errorTypeCounts: new Map([['어순', { total: 4, resolved: 1 }]]),
    }
    const p = calcGoalProgress(g, stats)
    expect(p.current).toBe(3)
    expect(p.percentage).toBe(25)
    expect(p.isAchieved).toBe(false)
  })

  it('is 100% (nothing to fix) when the subtype has no cards at all', () => {
    const p = calcGoalProgress(g, emptyStats())
    expect(p.percentage).toBe(100)
    expect(p.isAchieved).toBe(false) // total 0 → 달성으로 치지 않음
  })
})

describe('loadGoalStats', () => {
  it('returns counts and per-subtype tallies, skipping the subtype query when none given', async () => {
    handleQuery = (q) => {
      if (q.table === 'vocabulary') return { count: 12, error: null }
      if (q.table === 'error_cards' && q.count) return { count: 7, error: null }
      return { data: [], error: null }
    }
    const stats = await loadGoalStats(supa, 'u1', [])
    expect(stats.vocabCount).toBe(12)
    expect(stats.totalUnresolvedErrors).toBe(7)
    expect(stats.errorTypeCounts.size).toBe(0)
  })

  it('aggregates subtype rows into total/resolved buckets and de-dupes subtypes', async () => {
    handleQuery = (q) => {
      if (q.table === 'vocabulary') return { count: 0, error: null }
      if (q.table === 'error_cards' && q.count) return { count: 0, error: null }
      if (q.table === 'error_cards') {
        return {
          data: [
            { error_subtype: '어순', is_resolved: true },
            { error_subtype: '어순', is_resolved: false },
            { error_subtype: '把字句', is_resolved: true },
            { error_subtype: '무관', is_resolved: true }, // goals 에 없는 subtype → 무시
          ],
          error: null,
        }
      }
      return { data: [], error: null }
    }
    const stats = await loadGoalStats(supa, 'u1', ['어순', '어순', '把字句', '   '])
    expect(stats.errorTypeCounts.get('어순')).toEqual({ total: 2, resolved: 1 })
    expect(stats.errorTypeCounts.get('把字句')).toEqual({ total: 1, resolved: 1 })
    expect(stats.errorTypeCounts.has('무관')).toBe(false)
  })

  it('throws when the vocabulary count query errors', async () => {
    handleQuery = (q) =>
      q.table === 'vocabulary'
        ? { count: 0, error: { message: 'boom' } }
        : { count: 0, error: null }
    await expect(loadGoalStats(supa, 'u1', [])).rejects.toThrow(/vocabulary count 실패/)
  })
})

describe('calcProgressForGoals', () => {
  it('returns an empty array without touching the DB when there are no goals', async () => {
    handleQuery = () => {
      throw new Error('should not query')
    }
    expect(await calcProgressForGoals(supa, 'u1', [])).toEqual([])
  })

  it('loads stats once and maps each goal to its progress', async () => {
    handleQuery = (q) => {
      if (q.table === 'vocabulary') return { count: 60, error: null }
      if (q.table === 'error_cards' && q.count) return { count: 2, error: null }
      if (q.table === 'error_cards')
        return { data: [{ error_subtype: '어순', is_resolved: true }], error: null }
      return { data: [], error: null }
    }
    const goals: LearningGoal[] = [
      goal({ id: 'a', goal_type: 'vocab_count', target_value: '120' }),
      goal({ id: 'b', goal_type: 'error_type', target_value: '어순' }),
    ]
    const progress = await calcProgressForGoals(supa, 'u1', goals)
    expect(progress).toHaveLength(2)
    expect(progress[0].goal.id).toBe('a')
    expect(progress[0].percentage).toBe(50) // 60/120
    expect(progress[1].percentage).toBe(100) // 어순 1/1 resolved
  })
})
