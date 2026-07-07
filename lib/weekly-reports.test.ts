import { describe, it, expect, vi, beforeEach } from 'vitest'

// dispatchJSON 을 모킹: 전달된 parse 를 canned raw 에 적용(실제 parseSuggestions 로직도 검증).
const dispatchSpy = vi.fn()
let MOCK_RAW = '{}'
vi.mock('./ai/dispatch', () => ({
  dispatchJSON: vi.fn((task: string, opts: unknown, parse: (raw: string) => unknown) => {
    dispatchSpy(task, opts)
    return Promise.resolve(parse(MOCK_RAW))
  })
}))

// weekly-reports → professor-reports(toWeekStart) → ./supabase(next/headers) 전이 import 를
// 차단하기 위해 ./supabase 를 목킹한다.
vi.mock('./supabase', () => ({
  createServerClient: () => ({ from: vi.fn() }),
  createAdminClient: () => ({ from: vi.fn() })
}))

import {
  previousWeekStart,
  aggregateStudentsForWeek,
  generateStudentSuggestions,
  upsertStudentWeeklyReport,
  listStudentWeeklyReports,
  WEEKLY_REPORT_MODEL_ID
} from './weekly-reports'

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
  b.single = vi.fn(() => Promise.resolve(resultFor(table)))
  b.maybeSingle = vi.fn(() => Promise.resolve(resultFor(table)))
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(resultFor(table)).then(res, rej)
  return b
}
const admin = { from: vi.fn((t: string) => builder(t)) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminClient = admin as any

beforeEach(() => {
  dispatchSpy.mockClear()
  admin.from.mockClear()
  tableResults = {}
  MOCK_RAW = '{}'
})

describe('previousWeekStart()', () => {
  it('이번 주 월요일에서 7일 전 월요일', () => {
    expect(previousWeekStart(new Date('2026-07-07T12:00:00Z'))).toBe('2026-06-29')
  })
  it('월요일 입력도 직전 주 월요일로', () => {
    expect(previousWeekStart(new Date('2026-07-13T00:00:00Z'))).toBe('2026-07-06')
  })
})

describe('aggregateStudentsForWeek()', () => {
  it('studentIds 가 비면 빈 배열(쿼리 없음)', async () => {
    const res = await aggregateStudentsForWeek(adminClient, 'c1', [], '2026-07-06')
    expect(res).toEqual([])
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('학생별 세션/오류/화석화 집계, 무활동 학생은 0 지표', async () => {
    tableResults = {
      sessions: {
        data: [
          { id: 'ss1', student_id: 's1', draft_error_count: 10, revision_error_count: 5 },
          { id: 'ss2', student_id: 's1', draft_error_count: null, revision_error_count: null },
          { id: 'ss3', student_id: 's2', draft_error_count: 4, revision_error_count: 4 }
        ],
        error: null
      },
      error_cards: {
        data: [
          { student_id: 's1', error_subtype: '语序', fossilization_count: 3 },
          { student_id: 's1', error_subtype: '语序', fossilization_count: 5 },
          { student_id: 's1', error_subtype: '把字句', fossilization_count: 1 },
          { student_id: 's2', error_subtype: '', fossilization_count: 0 }
        ],
        error: null
      }
    }

    const res = await aggregateStudentsForWeek(adminClient, 'c1', ['s1', 's2', 's3'], '2026-07-06')
    expect(res.map(r => r.student_id)).toEqual(['s1', 's2', 's3'])

    expect(res[0].metrics).toEqual({
      total_sessions: 2,
      total_errors: 3,
      improvement_rate: 0.5,
      top_subtypes: [
        { subtype: '语序', count: 2 },
        { subtype: '把字句', count: 1 }
      ],
      // fossilization_count>=3 인 subtype 만, count 는 최댓값
      fossilization_alerts: [{ subtype: '语序', count: 5 }]
    })
    expect(res[1].metrics).toMatchObject({
      total_sessions: 1,
      total_errors: 1,
      improvement_rate: 0,
      top_subtypes: [],
      fossilization_alerts: []
    })
    expect(res[2].metrics).toEqual({
      total_sessions: 0,
      total_errors: 0,
      improvement_rate: null,
      top_subtypes: [],
      fossilization_alerts: []
    })
  })

  it('sessions 조회 에러 → throw', async () => {
    tableResults = { sessions: { data: null, error: { message: 'sess-fail' } } }
    await expect(
      aggregateStudentsForWeek(adminClient, 'c1', ['s1'], '2026-07-06')
    ).rejects.toThrow(/sessions 조회 실패.*sess-fail/)
  })
})

describe('generateStudentSuggestions()', () => {
  const input = {
    studentName: '김민수',
    className: '중급 작문',
    weekStart: '2026-07-06',
    metrics: {
      total_sessions: 3,
      total_errors: 5,
      improvement_rate: 0.4,
      top_subtypes: [{ subtype: '语序', count: 3 }],
      fossilization_alerts: []
    }
  }

  it('professor-report 태스크로 dispatch + 파싱 결과 반환', async () => {
    MOCK_RAW = JSON.stringify({
      headline: '이번 주도 잘했어요',
      focus_areas: [{ label: '语序', why: '어순 반복', action: '어순 5문장 연습' }],
      encouragement: '꾸준함이 좋아요',
      recommended_activities: ['문장 5개 다시 쓰기', '단어 10개 복습']
    })
    const res = await generateStudentSuggestions(input)
    expect(res.headline).toBe('이번 주도 잘했어요')
    expect(res.focus_areas).toHaveLength(1)
    expect(res.recommended_activities).toEqual(['문장 5개 다시 쓰기', '단어 10개 복습'])
    expect(dispatchSpy).toHaveBeenCalledWith(
      'professor-report',
      expect.objectContaining({ maxTokens: 1500, thinking: false })
    )
  })

  it('focus_areas / activities 최대 3개로 절단, label 없는 항목 제거', async () => {
    MOCK_RAW = JSON.stringify({
      headline: 'H',
      focus_areas: [
        { label: 'a', why: '', action: '' },
        { label: '', why: 'x', action: 'y' },
        { label: 'b' },
        { label: 'c' },
        { label: 'd' }
      ],
      recommended_activities: ['1', '2', '3', '4', '5']
    })
    const res = await generateStudentSuggestions(input)
    // slice(0,3) 가 label 빈값 제거보다 먼저 → 앞 3개 [a, '', b] 중 빈 label 제거 → [a, b]
    expect(res.focus_areas.map(f => f.label)).toEqual(['a', 'b'])
    expect(res.recommended_activities).toEqual(['1', '2', '3'])
  })

  it('headline 누락 → parse 실패로 reject', async () => {
    MOCK_RAW = JSON.stringify({ focus_areas: [] })
    await expect(generateStudentSuggestions(input)).rejects.toThrow(/headline 누락/)
  })
})

describe('upsertStudentWeeklyReport()', () => {
  const params = {
    studentId: 's1',
    classId: 'c1',
    weekStart: '2026-07-06',
    metrics: {
      total_sessions: 1,
      total_errors: 2,
      improvement_rate: null,
      top_subtypes: [],
      fossilization_alerts: []
    },
    suggestions: {
      headline: 'H',
      focus_areas: [],
      encouragement: '',
      recommended_activities: []
    }
  }

  it('저장 성공 → id 반환', async () => {
    tableResults.student_weekly_reports = { data: { id: 'w1' }, error: null }
    expect(await upsertStudentWeeklyReport(adminClient, params)).toBe('w1')
  })

  it('저장 실패 → throw', async () => {
    tableResults.student_weekly_reports = { data: null, error: { message: 'save-fail' } }
    await expect(upsertStudentWeeklyReport(adminClient, params)).rejects.toThrow(
      /student_weekly_reports 저장 실패.*save-fail/
    )
  })
})

describe('listStudentWeeklyReports()', () => {
  function row(over: Record<string, unknown> = {}) {
    return {
      id: 'w1',
      student_id: 's1',
      class_id: 'c1',
      week_start: '2026-07-06',
      metrics: { total_sessions: 2, total_errors: 3, improvement_rate: 0.3, top_subtypes: [], fossilization_alerts: [] },
      suggestions: { headline: 'H', focus_areas: [], encouragement: '', recommended_activities: [] },
      created_at: '2026-07-07T00:00:00Z',
      classes: { name: '중급 작문' },
      ...over
    }
  }

  it('행 매핑 + classes 배열/null, metrics/suggestions null 기본값', async () => {
    tableResults.student_weekly_reports = {
      data: [
        row(),
        row({ id: 'w2', classes: [{ name: '고급 작문' }] }),
        row({ id: 'w3', classes: null, metrics: null, suggestions: null })
      ],
      error: null
    }
    const list = await listStudentWeeklyReports(adminClient, 's1')
    expect(list[0]).toMatchObject({ id: 'w1', class_name: '중급 작문' })
    expect(list[1].class_name).toBe('고급 작문')
    expect(list[2].class_name).toBe('')
    expect(list[2].metrics.total_sessions).toBe(0)
    expect(list[2].suggestions.headline).toBe('')
  })

  it('조회 에러 → throw', async () => {
    tableResults.student_weekly_reports = { data: null, error: { message: 'list-fail' } }
    await expect(listStudentWeeklyReports(adminClient, 's1')).rejects.toThrow(
      /student_weekly_reports 조회 실패.*list-fail/
    )
  })
})

describe('WEEKLY_REPORT_MODEL_ID', () => {
  it('professor-report 태스크의 모델(haiku)로 고정', () => {
    expect(WEEKLY_REPORT_MODEL_ID).toBe('claude-haiku-4-5')
  })
})
