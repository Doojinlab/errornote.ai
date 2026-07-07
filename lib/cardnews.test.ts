import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WeekStats } from '@/types/cardnews'

// dispatchJSON 을 모킹: 전달된 parse 를 canned raw 에 적용(실제 parseClaudeShape 로직도 검증).
const dispatchSpy = vi.fn()
let MOCK_RAW = '{}'
vi.mock('./ai/dispatch', () => ({
  dispatchJSON: vi.fn((task: string, opts: unknown, parse: (raw: string) => unknown) => {
    dispatchSpy(task, opts)
    return Promise.resolve(parse(MOCK_RAW))
  })
}))

import {
  startOfWeekMonday,
  previousWeekStartISO,
  isValidWeekStart,
  collectWeekStats,
  toBarPoints,
  findMostImproved,
  computeGoalProgress,
  generateCardnewsPayload,
  upsertCardnewsRecord
} from './cardnews'

// 같은 테이블이 여러 번(이번주/지난주 error_cards) 조회되므로 FIFO 큐로 결과를 준다.
type QueryResult = { data: unknown; error: null | { message: string }; count?: number }
let queues: Record<string, QueryResult[]> = {}
function pushResult(table: string, r: QueryResult) {
  ;(queues[table] ??= []).push(r)
}
function nextResult(table: string): QueryResult {
  const q = queues[table]
  if (q && q.length) return q.shift() as QueryResult
  return { data: [], error: null }
}
function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lt', 'in', 'order', 'upsert', 'update', 'insert']) {
    b[m] = vi.fn(() => b)
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(nextResult(table)))
  b.single = vi.fn(() => Promise.resolve(nextResult(table)))
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(nextResult(table)).then(res, rej)
  return b
}
const mockSupabase = { from: vi.fn((t: string) => builder(t)) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = mockSupabase as any

beforeEach(() => {
  dispatchSpy.mockClear()
  mockSupabase.from.mockClear()
  queues = {}
  MOCK_RAW = '{}'
})

describe('startOfWeekMonday()', () => {
  it('항상 월요일(UTC)로 정규화', () => {
    expect(startOfWeekMonday(new Date('2026-07-07T10:00:00Z')).getUTCDay()).toBe(1)
    expect(startOfWeekMonday(new Date('2026-07-12T23:00:00Z')).toISOString().slice(0, 10)).toBe('2026-07-06')
  })
  it('월요일은 그 자신', () => {
    expect(startOfWeekMonday(new Date('2026-07-13T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-07-13')
  })
})

describe('previousWeekStartISO()', () => {
  it('이번 주 월요일에서 7일 전', () => {
    expect(previousWeekStartISO(new Date('2026-07-07T12:00:00Z'))).toBe('2026-06-29')
  })
})

describe('isValidWeekStart()', () => {
  it('월요일 YYYY-MM-DD 만 허용', () => {
    expect(isValidWeekStart('2026-07-06')).toBe(true) // 월
    expect(isValidWeekStart('2026-07-07')).toBe(false) // 화
    expect(isValidWeekStart('2026-7-6')).toBe(false) // 포맷 불일치
    expect(isValidWeekStart('garbage')).toBe(false)
    expect(isValidWeekStart('2026-13-40')).toBe(false) // 존재하지 않는 날짜
  })
})

describe('toBarPoints()', () => {
  it('내림차순 정렬 + limit 절단', () => {
    const pts = toBarPoints({ a: 1, b: 5, c: 3, d: 2 }, 2)
    expect(pts).toEqual([
      { name: 'b', value: 5 },
      { name: 'c', value: 3 }
    ])
  })
})

describe('findMostImproved()', () => {
  it('가장 크게 감소한 subtype 반환', () => {
    const r = findMostImproved({ 语序: 5, 量词: 3 }, { 语序: 2, 量词: 3 })
    expect(r).toEqual({ subtype: '语序', previous: 5, current: 2, delta: 3 })
  })
  it('개선 항목이 없으면 null 결과', () => {
    expect(findMostImproved({ a: 1 }, { a: 3 })).toEqual({
      subtype: null,
      previous: 0,
      current: 0,
      delta: 0
    })
  })
})

describe('computeGoalProgress()', () => {
  it('달성률 % 와 top 목표 라벨 계산', () => {
    const r = computeGoalProgress([
      { id: 'g1', label: '단어 50개', target_value: '50', current_value: 25, is_achieved: false },
      { id: 'g2', label: '오류 감소', target_value: '10', current_value: 10, is_achieved: true }
    ])
    expect(r.total_goals).toBe(2)
    expect(r.achieved_goals).toBe(1)
    expect(r.percent).toBe(50)
    // ratio: g1=0.5, g2=min(1,10/10)=1 → top 은 g2
    expect(r.top_goal_label).toBe('오류 감소')
  })
  it('목표 없으면 percent 0', () => {
    expect(computeGoalProgress([])).toEqual({
      total_goals: 0,
      achieved_goals: 0,
      percent: 0,
      top_goal_label: null
    })
  })
})

describe('collectWeekStats()', () => {
  function seedFullWeek() {
    pushResult('error_cards', {
      data: [
        { error_type: 'grammar', error_subtype: '语序', chapter_number: 3, fossilization_count: 3, created_at: 'x' },
        { error_type: 'grammar', error_subtype: '语序', chapter_number: 3, fossilization_count: 1, created_at: 'x' },
        { error_type: 'vocab', error_subtype: '量词', chapter_number: 3, fossilization_count: 0, created_at: 'x' }
      ],
      error: null
    })
    pushResult('error_cards', {
      data: [
        { error_type: 'grammar', error_subtype: '语序', chapter_number: 3, fossilization_count: 0, created_at: 'x' },
        { error_type: 'grammar', error_subtype: '语序', chapter_number: 3, fossilization_count: 0, created_at: 'x' },
        { error_type: 'grammar', error_subtype: '语序', chapter_number: 3, fossilization_count: 0, created_at: 'x' },
        { error_type: 'grammar', error_subtype: '把字句', chapter_number: 3, fossilization_count: 0, created_at: 'x' }
      ],
      error: null
    })
    pushResult('sessions', {
      data: [
        { chapter_number: 3, draft_error_count: 5, revision_error_count: 0, created_at: 'x' },
        { chapter_number: 3, draft_error_count: 4, revision_error_count: 2, created_at: 'x' },
        { chapter_number: 4, draft_error_count: 1, revision_error_count: 1, created_at: 'x' }
      ],
      error: null
    })
    pushResult('vocabulary', { data: null, error: null, count: 7 })
    pushResult('learning_goals', {
      data: [{ id: 'g1', goal_type: 'vocab_count', target_value: '50', current_value: 20, is_achieved: false }],
      error: null
    })
  }

  it('오류/세션/단어/목표를 한 주 단위로 집계 (classId 있으면 class_focus)', async () => {
    seedFullWeek()
    pushResult('classes', { data: { current_grammar_focus: '把字句' }, error: null })

    const stats = await collectWeekStats(sb, 's1', '2026-07-06', 'c1')

    expect(stats.week_start).toBe('2026-07-06')
    expect(stats.week_end).toBe('2026-07-12')
    expect(stats.total_sessions).toBe(3)
    expect(stats.total_errors_this_week).toBe(3)
    expect(stats.total_errors_last_week).toBe(4)
    expect(stats.grammar_count).toBe(2)
    expect(stats.vocab_count).toBe(1)
    expect(stats.current_chapter).toBe(3)
    expect(stats.subtype_counts_this_week).toEqual({ 语序: 2, 量词: 1 })
    expect(stats.subtype_counts_last_week).toEqual({ 语序: 3, 把字句: 1 })
    expect(stats.fossilized_subtypes).toEqual(['语序'])
    expect(stats.vocab_added_this_week).toBe(7)
    expect(stats.sessions_with_zero_errors).toBe(1)
    expect(stats.goals).toEqual([
      { id: 'g1', label: '단어 50개 암기', target_value: '50', current_value: 20, is_achieved: false }
    ])
    expect(stats.class_focus).toBe('把字句')
  })

  it('classId 없으면 classes 조회 없이 class_focus=null', async () => {
    seedFullWeek()
    const stats = await collectWeekStats(sb, 's1', '2026-07-06', null)
    expect(stats.class_focus).toBeNull()
    const queried = mockSupabase.from.mock.calls.map(c => c[0])
    expect(queried).not.toContain('classes')
  })
})

describe('generateCardnewsPayload()', () => {
  const stats: WeekStats = {
    student_id: 's1',
    class_id: 'c1',
    week_start: '2026-07-06',
    week_end: '2026-07-12',
    total_sessions: 3,
    total_errors_this_week: 5,
    total_errors_last_week: 8,
    current_chapter: 3,
    grammar_count: 3,
    vocab_count: 2,
    subtype_counts_this_week: { 语序: 2, 量词: 3 },
    subtype_counts_last_week: { 语序: 5, 量词: 3 },
    fossilized_subtypes: ['语序'],
    vocab_added_this_week: 10,
    sessions_with_zero_errors: 1,
    goals: [{ id: 'g1', label: '단어 50개 암기', target_value: '50', current_value: 25, is_achieved: false }],
    class_focus: '把字句'
  }

  it('Claude 카피 + 통계 파생값을 4장 카드로 합성', async () => {
    MOCK_RAW = JSON.stringify({
      card1: { week_summary: '오류가 줄었어요' },
      card2: { headline: '어순 개선', improved_subtype: null, positive_note: '잘하고 있어요' },
      card3: { action_title: '어순 퀴즈', action_detail: '5문장 재작성', estimated_minutes: 15 },
      card4: { next_chapter_number: 4, next_chapter_title: '제4과', preview_points: ['예습1', '예습2'] }
    })

    const payload = await generateCardnewsPayload(stats)

    expect(dispatchSpy).toHaveBeenCalledWith('cardnews', expect.objectContaining({ maxTokens: 4000 }))
    expect(payload.card1).toMatchObject({
      total_errors: 5,
      grammar_count: 3,
      vocab_count: 2,
      week_summary: '오류가 줄었어요'
    })
    expect(payload.card1.by_subtype).toEqual([
      { name: '量词', value: 3 },
      { name: '语序', value: 2 }
    ])
    // improved_subtype 이 null 이면 통계상 가장 개선된 subtype 로 폴백
    expect(payload.card2).toMatchObject({
      headline: '어순 개선',
      improved_subtype: '语序',
      previous_count: 5,
      current_count: 2,
      delta: 3
    })
    expect(payload.card3).toMatchObject({
      action_title: '어순 퀴즈',
      estimated_minutes: 15,
      goal_progress_percent: 0,
      goal_label: '단어 50개 암기'
    })
    expect(payload.card4).toMatchObject({
      next_chapter_number: 4,
      next_chapter_title: '제4과',
      preview_points: ['예습1', '예습2'],
      focus_grammar: '把字句'
    })
  })

  it('estimated_minutes 는 5~60 클램프, next_chapter_number null 이면 current+1 폴백', async () => {
    MOCK_RAW = JSON.stringify({
      card1: { week_summary: 's' },
      card2: { headline: 'h', improved_subtype: '量词', positive_note: 'p' },
      card3: { action_title: 't', action_detail: 'd', estimated_minutes: 999 },
      card4: { next_chapter_number: null, next_chapter_title: '', preview_points: [] }
    })
    const payload = await generateCardnewsPayload(stats)
    expect(payload.card3.estimated_minutes).toBe(60)
    expect(payload.card2.improved_subtype).toBe('量词') // 명시값 우선
    expect(payload.card4.next_chapter_number).toBe(4) // current_chapter(3) + 1
  })
})

describe('upsertCardnewsRecord()', () => {
  const payload = {
    card1: { total_errors: 5, grammar_count: 3, vocab_count: 2, by_subtype: [], week_summary: 's' },
    card2: { headline: 'h', improved_subtype: null, previous_count: 0, current_count: 0, delta: 0, positive_note: 'p' },
    card3: { action_title: 't', action_detail: 'd', estimated_minutes: 15, goal_progress_percent: 0, goal_label: null },
    card4: { next_chapter_number: 4, next_chapter_title: '', preview_points: [], focus_grammar: null },
    goal_progress: { total_goals: 0, achieved_goals: 0, percent: 0, top_goal_label: null }
  }

  it('upsert 성공 → id/created_at 반환', async () => {
    pushResult('weekly_cardnews', { data: { id: 'cn1', created_at: '2026-07-07T00:00:00Z' }, error: null })
    const res = await upsertCardnewsRecord(sb, 's1', '2026-07-06', 'c1', payload)
    expect(res).toEqual({ id: 'cn1', created_at: '2026-07-07T00:00:00Z' })
  })

  it('upsert 실패 → throw', async () => {
    pushResult('weekly_cardnews', { data: null, error: { message: 'cn-fail' } })
    await expect(upsertCardnewsRecord(sb, 's1', '2026-07-06', 'c1', payload)).rejects.toThrow(
      /weekly_cardnews upsert 실패.*cn-fail/
    )
  })
})
