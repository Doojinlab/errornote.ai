import { describe, it, expect, vi, beforeEach } from 'vitest'

// dispatchJSON 을 모킹: 전달된 parse 를 canned raw 에 적용(실제 parseReport 로직도 검증).
const dispatchSpy = vi.fn()
let MOCK_RAW = '{}'
vi.mock('./ai/dispatch', () => ({
  dispatchJSON: vi.fn((task: string, opts: unknown, parse: (raw: string) => unknown) => {
    dispatchSpy(task, opts)
    return Promise.resolve(parse(MOCK_RAW))
  })
}))

import { aggregateWeekAdmin, generateWeeklyReportAdmin } from './professor-reports-admin'

// admin(service-role) 클라이언트 목 — per-table 결과 지정.
type QueryResult = { data: unknown; error: null | { message: string } }
let tableResults: Record<string, QueryResult> = {}
function resultFor(table: string): QueryResult {
  return tableResults[table] ?? { data: [], error: null }
}
function builder(table: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lt', 'in', 'order', 'upsert', 'update', 'insert']) {
    b[m] = vi.fn(() => b)
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(resultFor(table)))
  b.single = vi.fn(() => Promise.resolve(resultFor(table)))
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(resultFor(table)).then(res, rej)
  return b
}
const admin = { from: vi.fn((t: string) => builder(t)) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminClient = admin as any

function fullAggregateTables() {
  tableResults = {
    classes: { data: { id: 'c1', name: '작문 실습' }, error: null },
    enrollments: {
      data: [
        { student_id: 's1', profiles: { id: 's1', name: '박지훈' } },
        { student_id: 's2', profiles: null }
      ],
      error: null
    },
    sessions: {
      data: [
        { id: 'ss1', student_id: 's1', created_at: '2026-07-06T01:00:00Z', draft_error_count: 8, revision_error_count: 2 },
        { id: 'ss2', student_id: 's2', created_at: '2026-07-07T01:00:00Z', draft_error_count: null, revision_error_count: null }
      ],
      error: null
    },
    error_cards: {
      data: [
        { student_id: 's1', error_subtype: '离合词', fossilization_count: 4, created_at: 'x' },
        { student_id: 's1', error_subtype: '离合词', fossilization_count: 6, created_at: 'x' },
        { student_id: 's2', error_subtype: '语气词', fossilization_count: 1, created_at: 'x' }
      ],
      error: null
    }
  }
}

beforeEach(() => {
  dispatchSpy.mockClear()
  admin.from.mockClear()
  tableResults = {}
  MOCK_RAW = '{}'
})

describe('aggregateWeekAdmin()', () => {
  it('전달된 admin 클라이언트로 집계 수행', async () => {
    fullAggregateTables()
    const agg = await aggregateWeekAdmin(adminClient, 'c1', '2026-07-06')

    expect(agg.className).toBe('작문 실습')
    expect(agg.weekEnd).toBe('2026-07-13')
    expect(agg.metrics).toEqual({
      total_students: 2,
      active_students: 2,
      total_sessions: 2,
      total_errors: 3,
      avg_errors_per_session: 1.5
    })
    expect(agg.topSubtypes[0]).toEqual({ error_subtype: '离合词', count: 2 })
    expect(agg.studentSummaries[0]).toMatchObject({
      student_id: 's1',
      name: '박지훈',
      session_count: 1,
      error_count: 2,
      top_subtype: '离合词',
      improvement_rate: 0.75
    })
    expect(agg.fossilizationCandidates).toEqual([
      { student_id: 's1', name: '박지훈', error_subtype: '离合词', count: 4 }
    ])
  })

  it('존재하지 않는 수업 → throw', async () => {
    tableResults = { classes: { data: null, error: null } }
    await expect(aggregateWeekAdmin(adminClient, 'nope', '2026-07-06')).rejects.toThrow(
      /존재하지 않는 수업/
    )
  })

  it('enrollments 조회 에러 → throw', async () => {
    tableResults = {
      classes: { data: { id: 'c1', name: 'A' }, error: null },
      enrollments: { data: null, error: { message: 'enr-fail' } }
    }
    await expect(aggregateWeekAdmin(adminClient, 'c1', '2026-07-06')).rejects.toThrow(
      /enrollments 조회 실패.*enr-fail/
    )
  })
})

describe('generateWeeklyReportAdmin()', () => {
  const reportRaw = JSON.stringify({
    focus_points: [{ error_subtype: '离合词', incidence: 2, reason: '이합사 분리 오류' }],
    praise_students: [{ student_id: 's1', name: '박지훈', highlight: '개선율 75%' }],
    care_students: [],
    fossilization_alerts: [{ student_id: 'sZ', name: '가짜', error_subtype: 'x', count: 9 }],
    next_class_suggestion: '이합사 분리 규칙 복습'
  })

  it('집계+Claude+upsert 후 리포트 반환, 화석화는 집계값 우선', async () => {
    fullAggregateTables()
    tableResults.professor_reports = { data: { id: 'r9', created_at: '2026-07-07T00:00:00Z' }, error: null }
    MOCK_RAW = reportRaw

    const report = await generateWeeklyReportAdmin(adminClient, 'prof1', 'c1', '2026-07-06')

    expect(report).toMatchObject({
      id: 'r9',
      class_id: 'c1',
      class_name: '작문 실습',
      week_start: '2026-07-06',
      next_class_suggestion: '이합사 분리 규칙 복습'
    })
    expect(report.fossilization_alerts).toEqual([
      { student_id: 's1', name: '박지훈', error_subtype: '离合词', count: 4 }
    ])
    expect(dispatchSpy).toHaveBeenCalledWith(
      'professor-report',
      expect.objectContaining({ maxTokens: 4000 })
    )
  })

  it('저장 실패 → throw', async () => {
    fullAggregateTables()
    tableResults.professor_reports = { data: null, error: { message: 'save-fail' } }
    MOCK_RAW = reportRaw
    await expect(generateWeeklyReportAdmin(adminClient, 'prof1', 'c1', '2026-07-06')).rejects.toThrow(
      /professor_reports 저장 실패.*save-fail/
    )
  })
})
