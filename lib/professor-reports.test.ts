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

// per-table 결과를 지정할 수 있는 체이닝 + awaitable 빌더.
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
const mockSupabase = { from: vi.fn((t: string) => builder(t)) }
vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

import {
  toWeekStart,
  currentWeekStart,
  aggregateWeek,
  generateWeeklyReport,
  listReports,
  getReport
} from './professor-reports'

function fullAggregateTables() {
  tableResults = {
    classes: { data: { id: 'c1', name: '중급 작문' }, error: null },
    enrollments: {
      data: [
        { student_id: 's1', profiles: { id: 's1', name: '김민수' } },
        { student_id: 's2', profiles: [{ id: 's2', name: '이서연' }] },
        { student_id: 's3', profiles: null }
      ],
      error: null
    },
    sessions: {
      data: [
        { id: 'ss1', student_id: 's1', created_at: '2026-07-06T01:00:00Z', draft_error_count: 10, revision_error_count: 4 },
        { id: 'ss2', student_id: 's1', created_at: '2026-07-07T01:00:00Z', draft_error_count: null, revision_error_count: null },
        { id: 'ss3', student_id: 's2', created_at: '2026-07-08T01:00:00Z', draft_error_count: 6, revision_error_count: 6 }
      ],
      error: null
    },
    error_cards: {
      data: [
        { student_id: 's1', error_subtype: '语序', fossilization_count: 3, created_at: 'x' },
        { student_id: 's1', error_subtype: '语序', fossilization_count: 5, created_at: 'x' },
        { student_id: 's1', error_subtype: '把字句', fossilization_count: 1, created_at: 'x' },
        { student_id: 's2', error_subtype: '  ', fossilization_count: 0, created_at: 'x' }
      ],
      error: null
    }
  }
}

beforeEach(() => {
  dispatchSpy.mockClear()
  mockSupabase.from.mockClear()
  tableResults = {}
  MOCK_RAW = '{}'
})

describe('toWeekStart()', () => {
  it('평일은 해당 주 월요일로 정규화', () => {
    expect(toWeekStart(new Date('2026-07-07T10:00:00Z'))).toBe('2026-07-06')
  })
  it('일요일은 직전 월요일로 정규화', () => {
    expect(toWeekStart(new Date('2026-07-12T23:00:00Z'))).toBe('2026-07-06')
  })
  it('월요일은 그 자신', () => {
    expect(toWeekStart(new Date('2026-07-13T00:00:00Z'))).toBe('2026-07-13')
  })
})

describe('currentWeekStart()', () => {
  it('항상 월요일(UTC)을 반환', () => {
    const iso = currentWeekStart()
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(`${iso}T00:00:00Z`).getUTCDay()).toBe(1)
  })
})

describe('aggregateWeek()', () => {
  it('세션·오류를 지표/상위subtype/학생요약/화석화로 집계', async () => {
    fullAggregateTables()
    const agg = await aggregateWeek('c1', '2026-07-06')

    expect(agg.className).toBe('중급 작문')
    expect(agg.weekStart).toBe('2026-07-06')
    expect(agg.weekEnd).toBe('2026-07-13')
    expect(agg.metrics).toEqual({
      total_students: 3,
      active_students: 2,
      total_sessions: 3,
      total_errors: 4,
      avg_errors_per_session: 1.33
    })
    expect(agg.topSubtypes).toEqual([
      { error_subtype: '语序', count: 2 },
      { error_subtype: '把字句', count: 1 }
    ])
    // session_count 내림차순 정렬 → s1 먼저
    expect(agg.studentSummaries[0]).toMatchObject({
      student_id: 's1',
      name: '김민수',
      session_count: 2,
      error_count: 3,
      top_subtype: '语序',
      improvement_rate: 0.6
    })
    expect(agg.studentSummaries[1]).toMatchObject({
      student_id: 's2',
      name: '이서연',
      session_count: 1,
      top_subtype: null,
      improvement_rate: 0
    })
    // 화석화 후보는 student::subtype 로 dedupe, 첫 등장 count 사용
    expect(agg.fossilizationCandidates).toEqual([
      { student_id: 's1', name: '김민수', error_subtype: '语序', count: 3 }
    ])
  })

  it('세션이 없으면 error_cards 조회를 건너뛰고 0 지표', async () => {
    tableResults = {
      classes: { data: { id: 'c1', name: 'A' }, error: null },
      enrollments: { data: [{ student_id: 's1', profiles: { id: 's1', name: '김' } }], error: null },
      sessions: { data: [], error: null }
    }
    const agg = await aggregateWeek('c1', '2026-07-06')
    expect(agg.metrics.total_errors).toBe(0)
    expect(agg.metrics.avg_errors_per_session).toBe(0)
    expect(agg.topSubtypes).toEqual([])
    // error_cards 테이블은 조회되지 않음
    const queried = mockSupabase.from.mock.calls.map(c => c[0])
    expect(queried).not.toContain('error_cards')
  })

  it('존재하지 않는 수업 → throw', async () => {
    tableResults = { classes: { data: null, error: null } }
    await expect(aggregateWeek('nope', '2026-07-06')).rejects.toThrow(/존재하지 않는 수업/)
  })

  it('classes 조회 에러 → throw', async () => {
    tableResults = { classes: { data: null, error: { message: 'boom' } } }
    await expect(aggregateWeek('c1', '2026-07-06')).rejects.toThrow(/classes 조회 실패.*boom/)
  })

  it('sessions 조회 에러 → throw', async () => {
    tableResults = {
      classes: { data: { id: 'c1', name: 'A' }, error: null },
      enrollments: { data: [], error: null },
      sessions: { data: null, error: { message: 'sess-fail' } }
    }
    await expect(aggregateWeek('c1', '2026-07-06')).rejects.toThrow(/sessions 조회 실패.*sess-fail/)
  })
})

describe('generateWeeklyReport()', () => {
  const reportRaw = JSON.stringify({
    focus_points: [{ error_subtype: '语序', incidence: 2, reason: '어순 오류 빈번' }],
    praise_students: [{ student_id: 's1', name: '김민수', highlight: '개선율 60%' }],
    care_students: [{ student_id: 's2', name: '이서연', concern: '정체', suggested_action: '1:1 피드백' }],
    fossilization_alerts: [{ student_id: 'sX', name: '가짜', error_subtype: 'quan', count: 9 }],
    next_class_suggestion: '어순 집중 수업 제안'
  })

  it('집계+Claude+upsert 후 리포트 반환, 화석화는 집계값(ground-truth) 우선', async () => {
    fullAggregateTables()
    tableResults.professor_reports = { data: { id: 'r1', created_at: '2026-07-07T00:00:00Z' }, error: null }
    MOCK_RAW = reportRaw

    const report = await generateWeeklyReport('prof1', 'c1', '2026-07-06')

    expect(report).toMatchObject({
      id: 'r1',
      class_id: 'c1',
      class_name: '중급 작문',
      week_start: '2026-07-06',
      next_class_suggestion: '어순 집중 수업 제안',
      created_at: '2026-07-07T00:00:00Z'
    })
    expect(report.focus_points[0].error_subtype).toBe('语序')
    expect(report.metrics.total_students).toBe(3)
    // 집계 화석화 후보가 있으므로 Claude 의 가짜 목록 대신 집계값 사용
    expect(report.fossilization_alerts).toEqual([
      { student_id: 's1', name: '김민수', error_subtype: '语序', count: 3 }
    ])
    expect(dispatchSpy).toHaveBeenCalledWith(
      'professor-report',
      expect.objectContaining({ maxTokens: 4000 })
    )
  })

  it('집계 화석화 후보가 없으면 Claude 출력의 alert 를 사용', async () => {
    tableResults = {
      classes: { data: { id: 'c1', name: '중급 작문' }, error: null },
      enrollments: { data: [{ student_id: 's1', profiles: { id: 's1', name: '김민수' } }], error: null },
      sessions: { data: [], error: null },
      professor_reports: { data: { id: 'r2', created_at: '2026-07-07T00:00:00Z' }, error: null }
    }
    MOCK_RAW = reportRaw
    const report = await generateWeeklyReport('prof1', 'c1', '2026-07-06')
    expect(report.fossilization_alerts[0].student_id).toBe('sX')
  })

  it('professor_reports 저장 실패 → throw', async () => {
    fullAggregateTables()
    tableResults.professor_reports = { data: null, error: { message: 'db down' } }
    MOCK_RAW = reportRaw
    await expect(generateWeeklyReport('prof1', 'c1', '2026-07-06')).rejects.toThrow(
      /professor_reports 저장 실패.*db down/
    )
  })
})

describe('listReports() / getReport()', () => {
  function reportRow(over: Record<string, unknown> = {}) {
    return {
      id: 'r1',
      class_id: 'c1',
      week_start: '2026-07-06',
      focus_points: [{ error_subtype: '语序', incidence: 2, reason: 'r' }],
      praise_students: [],
      care_students: [],
      fossilization_alerts: [],
      next_class_suggestion: '다음 수업 제안',
      metrics: { total_students: 5 },
      created_at: '2026-07-07T00:00:00Z',
      classes: { name: '중급 작문' },
      ...over
    }
  }

  it('listReports: 행을 도메인 모델로 매핑, classes 배열/null 처리', async () => {
    tableResults.professor_reports = {
      data: [reportRow(), reportRow({ id: 'r2', classes: [{ name: '고급 작문' }] }), reportRow({ id: 'r3', classes: null })],
      error: null
    }
    const list = await listReports('prof1')
    expect(list).toHaveLength(3)
    expect(list[0]).toMatchObject({ id: 'r1', class_name: '중급 작문', next_class_suggestion: '다음 수업 제안' })
    expect(list[1].class_name).toBe('고급 작문')
    expect(list[2].class_name).toBe('(수업 없음)')
    // metrics 기본값 병합
    expect(list[0].metrics).toEqual({
      total_students: 5,
      active_students: 0,
      total_sessions: 0,
      total_errors: 0,
      avg_errors_per_session: 0
    })
  })

  it('listReports: 조회 에러 → throw', async () => {
    tableResults.professor_reports = { data: null, error: { message: 'list-fail' } }
    await expect(listReports('prof1')).rejects.toThrow(/리포트 목록 조회 실패.*list-fail/)
  })

  it('getReport: 행이 있으면 매핑, 없으면 null', async () => {
    tableResults.professor_reports = { data: reportRow(), error: null }
    const r = await getReport('prof1', 'r1')
    expect(r?.id).toBe('r1')

    tableResults.professor_reports = { data: null, error: null }
    expect(await getReport('prof1', 'nope')).toBeNull()
  })

  it('getReport: 조회 에러 → throw', async () => {
    tableResults.professor_reports = { data: null, error: { message: 'get-fail' } }
    await expect(getReport('prof1', 'r1')).rejects.toThrow(/리포트 조회 실패.*get-fail/)
  })
})
