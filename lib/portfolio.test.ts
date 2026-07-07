import { describe, it, expect, beforeEach, vi } from 'vitest'
import { assemblePortfolio } from './portfolio'

// ── Supabase(admin) 모의 ──────────────────────────────────────────────────────
interface QueryShape {
  table: string
  count: boolean
  single: boolean
  filters: Array<[string, string, unknown]>
}
type QueryResult = { data?: unknown; error?: unknown; count?: number }

let handleQuery: (q: QueryShape) => QueryResult = () => ({ data: null, error: null })
let getUserByIdImpl: (id: string) => Promise<{ data: unknown }> = async () => ({ data: { user: { email: null } } })

function makeBuilder(table: string) {
  const q: QueryShape = { table, count: false, single: false, filters: [] }
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
    not: (c: string, _op: string, v: unknown) => {
      q.filters.push(['not', c, v])
      return b
    },
    order: () => b,
    single: () => {
      q.single = true
      return Promise.resolve(handleQuery(q))
    },
    maybeSingle: () => {
      q.single = true
      return Promise.resolve(handleQuery(q))
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(handleQuery(q)).then(resolve, reject),
  }
  return b
}

const mockSupabase = {
  from: (table: string) => makeBuilder(table),
  auth: { admin: { getUserById: (id: string) => getUserByIdImpl(id) } },
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase,
}))

beforeEach(() => {
  handleQuery = () => ({ data: null, error: null })
  getUserByIdImpl = async () => ({ data: { user: { email: null } } })
})

describe('assemblePortfolio', () => {
  it('assembles the full portfolio with scores, error stats and top sessions', async () => {
    getUserByIdImpl = async () => ({ data: { user: { email: 'me@uni.ac.kr' } } })
    handleQuery = (q) => {
      switch (q.table) {
        case 'profiles':
          return { data: { language: 'en', created_at: '2026-01-01T00:00:00Z' }, error: null }
        case 'gamification_stats':
          return { data: { xp: 320, level: 4, streak_days: 9 }, error: null }
        case 'sessions':
          return {
            data: [
              { id: 'se1', chapter_number: 2, draft_text: '초안1', revision_text: '수정1', created_at: '2026-05-01T00:00:00Z' },
              { id: 'se2', chapter_number: 3, draft_text: '초안2', revision_text: '수정2', created_at: '2026-05-08T00:00:00Z' },
            ],
            error: null,
          }
        case 'badges':
          return { data: [{ badge_name: '첫 제출', earned_at: '2026-05-01T00:00:00Z' }], error: null }
        case 'learning_goals':
          return { data: [{ goal_type: 'vocab_count', target_value: '100', current_value: 40 }], error: null }
        case 'vocabulary':
          return { count: 42, error: null }
        case 'error_cards':
          return {
            data: [
              { error_type: 'grammar', session_id: 'se1' },
              { error_type: 'grammar', session_id: 'se1' },
              { error_type: 'vocab', session_id: 'se2' },
            ],
            error: null,
          }
        case 'rubric_evaluations':
          return {
            data: [
              { session_id: 'se1', total_score: 70, ai_feedback: '보통' },
              { session_id: 'se2', total_score: 95, ai_feedback: '훌륭' },
            ],
            error: null,
          }
        default:
          return { data: null, error: null }
      }
    }
    const p = await assemblePortfolio('u1')
    expect(p.student).toEqual({ email: 'me@uni.ac.kr', language_preference: 'en', joined_at: '2026-01-01T00:00:00Z' })
    expect(p.gamification).toEqual({ xp: 320, level: 4, streak_days: 9 })
    expect(p.totalSessions).toBe(2)
    expect(p.totalErrors).toBe(3)
    expect(p.vocabularyCount).toBe(42)
    // 에러 통계: grammar 2, vocab 1 (내림차순)
    expect(p.errorStats).toEqual([{ type: 'grammar', count: 2 }, { type: 'vocab', count: 1 }])
    // topSessions: 점수 내림차순 → se2(95) 먼저
    expect(p.topSessions[0].id).toBe('se2')
    expect(p.topSessions[0].score).toBe(95)
    expect(p.topSessions[0].error_count).toBe(1)
    expect(p.topSessions[1].error_count).toBe(2)
    // learning_goals → goalsProgress 매핑
    expect(p.goalsProgress).toEqual([{ goal: 'vocab_count', target_value: 100, current_value: 40 }])
    expect(p.badgesEarned).toHaveLength(1)
    expect(typeof p.generatedAt).toBe('string')
  })

  it('falls back to defaults when stats, profile and joins are empty', async () => {
    handleQuery = (q) => {
      if (q.table === 'sessions') return { data: [], error: null }
      if (q.table === 'vocabulary') return { count: undefined, error: null }
      return { data: null, error: null }
    }
    const p = await assemblePortfolio('u1')
    expect(p.student).toEqual({ email: null, language_preference: 'ko', joined_at: '' })
    expect(p.gamification).toEqual({ xp: 0, level: 0, streak_days: 0 })
    expect(p.totalSessions).toBe(0)
    expect(p.totalErrors).toBe(0)
    expect(p.vocabularyCount).toBe(0)
    expect(p.topSessions).toEqual([])
    expect(p.errorStats).toEqual([])
    expect(p.goalsProgress).toEqual([])
    expect(p.badgesEarned).toEqual([])
  })

  it('skips the error/eval joins entirely when there are no submitted sessions', async () => {
    let errorCardsQueried = false
    handleQuery = (q) => {
      if (q.table === 'error_cards' || q.table === 'rubric_evaluations') {
        errorCardsQueried = true
        return { data: [], error: null }
      }
      if (q.table === 'sessions') return { data: [], error: null }
      if (q.table === 'vocabulary') return { count: 0, error: null }
      return { data: null, error: null }
    }
    const p = await assemblePortfolio('u1')
    expect(errorCardsQueried).toBe(false) // sessionIds 가 비어 조회 자체를 생략
    expect(p.topSessions).toEqual([])
  })

  it('keeps the first rubric evaluation per session and caps top sessions at five', async () => {
    handleQuery = (q) => {
      switch (q.table) {
        case 'sessions':
          return {
            data: Array.from({ length: 6 }, (_, i) => ({
              id: `se${i}`, chapter_number: i, draft_text: 'd', revision_text: 'r', created_at: `2026-05-0${i + 1}T00:00:00Z`,
            })),
            error: null,
          }
        case 'vocabulary':
          return { count: 0, error: null }
        case 'error_cards':
          return { data: [], error: null }
        case 'rubric_evaluations':
          return {
            data: [
              { session_id: 'se0', total_score: 50, ai_feedback: '첫 평가' },
              { session_id: 'se0', total_score: 99, ai_feedback: '두 번째(무시)' },
            ],
            error: null,
          }
        default:
          return { data: null, error: null }
      }
    }
    const p = await assemblePortfolio('u1')
    expect(p.totalSessions).toBe(6)
    expect(p.topSessions).toHaveLength(5) // 상위 5개만
    const se0 = p.topSessions.find((s) => s.id === 'se0')
    expect(se0?.score).toBe(50) // 첫 평가만 채택
    expect(se0?.feedback).toBe('첫 평가')
  })
})
