import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  anonymizeId,
  serializeToCSV,
  buildDownloadResponse,
  assembleProfessorExport,
  assembleStudentExport,
} from './export'
import type { ResearchExportOptions } from '@/types/export'

// ── Supabase 모의 ─────────────────────────────────────────────────────────────
// export.ts 는 여러 테이블을 select/maybeSingle/list 로 섞어 호출하므로
// 쿼리 형태(table·filters·single)를 받아 응답을 돌려주는 handler 기반 빌더를 쓴다.
interface QueryShape {
  table: string
  single: boolean
  filters: Array<[string, string, unknown]>
}
type QueryResult = { data?: unknown; error?: unknown; count?: number }

let handleQuery: (q: QueryShape) => QueryResult = () => ({ data: [], error: null })
let getUserByIdImpl: (id: string) => Promise<{ data: unknown }> = async () => ({
  data: { user: { email: 'stub@example.com' } },
})

function makeBuilder(table: string) {
  const q: QueryShape = { table, single: false, filters: [] }
  const b: Record<string, unknown> = {
    select: () => b,
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
    gte: (c: string, v: unknown) => {
      q.filters.push(['gte', c, v])
      return b
    },
    lte: (c: string, v: unknown) => {
      q.filters.push(['lte', c, v])
      return b
    },
    order: () => b,
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

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase,
}))

beforeEach(() => {
  handleQuery = () => ({ data: [], error: null })
  getUserByIdImpl = async () => ({ data: { user: { email: 'stub@example.com' } } })
})

// ── 순수 함수 ─────────────────────────────────────────────────────────────────

describe('anonymizeId', () => {
  it('is a stable 8-char hex prefix of the sha256 digest', () => {
    const a = anonymizeId('student-123')
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(anonymizeId('student-123')).toBe(a) // deterministic
  })

  it('maps different ids to different hashes', () => {
    expect(anonymizeId('a')).not.toBe(anonymizeId('b'))
  })
})

describe('serializeToCSV', () => {
  it('returns an empty string for no rows', () => {
    expect(serializeToCSV([])).toBe('')
  })

  it('uses object keys as the header and CRLF row separators', () => {
    const csv = serializeToCSV([{ a: 1, b: 2 }, { a: 3, b: 4 }])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('honors an explicit header order and projects only those keys', () => {
    const csv = serializeToCSV([{ a: 1, b: 2, c: 3 }], ['b', 'a'])
    expect(csv).toBe('b,a\r\n2,1')
  })

  it('quotes and escapes cells containing commas, quotes or newlines', () => {
    const csv = serializeToCSV([{ v: 'a,b' }, { v: 'say "hi"' }, { v: 'line\nbreak' }])
    expect(csv).toBe('v\r\n"a,b"\r\n"say ""hi"""\r\n"line\nbreak"')
  })

  it('renders null/undefined as empty cells', () => {
    expect(serializeToCSV([{ a: null, b: undefined }])).toBe('a,b\r\n,')
  })
})

describe('buildDownloadResponse', () => {
  it('sets csv content-type and attachment headers', async () => {
    const res = buildDownloadResponse('a,b', 'csv', 'data.csv')
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="data.csv"')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.text()).toBe('a,b')
  })

  it('sets json content-type for the json format', () => {
    const res = buildDownloadResponse('{}', 'json', 'data.json')
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
  })
})

// ── 연구용 교수자 익스포트 ─────────────────────────────────────────────────────

const options = (over: Partial<ResearchExportOptions> = {}): ResearchExportOptions => ({
  classId: 'class-1',
  format: 'json',
  anonymizationLevel: 'partial',
  ...over,
})

describe('assembleProfessorExport', () => {
  it('throws when the class is missing or not owned by the professor', async () => {
    handleQuery = (q) => (q.table === 'classes' ? { data: null, error: null } : { data: [], error: null })
    await expect(assembleProfessorExport('prof-1', options())).rejects.toThrow(/access denied/)
  })

  it('returns an empty payload (no session query) when the class has no students', async () => {
    handleQuery = (q) => {
      if (q.table === 'classes')
        return { data: { id: 'class-1', name: '중급 작문', semester: '2026-1' }, error: null }
      if (q.table === 'enrollments') return { data: [], error: null }
      return { data: [], error: null }
    }
    const payload = await assembleProfessorExport('prof-1', options())
    expect(payload.metadata.totalStudents).toBe(0)
    expect(payload.metadata.totalSessions).toBe(0)
    expect(payload.students).toEqual([])
    expect(payload.errors).toEqual([])
    expect(payload.progress).toEqual([])
  })

  it('anonymizes students, aggregates progress and redacts spans on full anonymization', async () => {
    handleQuery = (q) => {
      switch (q.table) {
        case 'classes':
          return { data: { id: 'class-1', name: '중급 작문', semester: '2026-1' }, error: null }
        case 'enrollments':
          return {
            data: [
              { student_id: 's1', enrolled_at: '2026-03-01T00:00:00Z' },
              { student_id: 's2', enrolled_at: '2026-03-02T00:00:00Z' },
            ],
            error: null,
          }
        case 'sessions':
          return {
            data: [
              { id: 'se1', student_id: 's1', chapter_number: 3, revision_error_count: 2, created_at: '2026-04-01T00:00:00Z' },
              { id: 'se2', student_id: 's1', chapter_number: 4, revision_error_count: 4, created_at: '2026-04-08T00:00:00Z' },
            ],
            error: null,
          }
        case 'error_cards':
          return {
            data: [
              {
                session_id: 'se1',
                student_id: 's1',
                chapter_number: 3,
                error_type: 'grammar',
                error_subtype: '어순',
                error_span: '看书在图书馆',
                correction: '在图书馆看书',
                hsk_level: 3,
                fossilization_count: 1,
                created_at: '2026-04-01T00:00:00Z',
              },
            ],
            error: null,
          }
        default:
          return { data: [], error: null }
      }
    }
    const payload = await assembleProfessorExport('prof-1', options({ anonymizationLevel: 'full' }))
    expect(payload.metadata.totalStudents).toBe(2)
    expect(payload.metadata.totalSessions).toBe(2)
    expect(payload.metadata.totalErrors).toBe(1)
    // full → student id 는 8자리 해시로 치환
    expect(payload.students[0].studentHash).toMatch(/^[0-9a-f]{8}$/)
    expect(payload.errors[0].errorSpan).toBe('[redacted]')
    // s1 은 세션 2개, 오류 2+4=6, 평균 3.0
    const s1 = payload.progress.find((p) => p.sessionCount === 2)
    expect(s1?.totalErrors).toBe(6)
    expect(s1?.avgErrorsPerSession).toBe(3)
    expect(s1?.lastActiveAt).toBe('2026-04-08T00:00:00Z')
  })

  it('keeps raw ids and spans when anonymization is "none"', async () => {
    handleQuery = (q) => {
      switch (q.table) {
        case 'classes':
          return { data: { id: 'class-1', name: 'c', semester: 's' }, error: null }
        case 'enrollments':
          return { data: [{ student_id: 's1', enrolled_at: '2026-03-01T00:00:00Z' }], error: null }
        case 'sessions':
          return { data: [], error: null }
        default:
          return { data: [], error: null }
      }
    }
    const payload = await assembleProfessorExport('prof-1', options({ anonymizationLevel: 'none' }))
    expect(payload.students[0].studentHash).toBe('s1') // 원본 id 유지
  })
})

// ── 학습자 본인 데이터 이동권 익스포트 ─────────────────────────────────────────

describe('assembleStudentExport', () => {
  it('assembles profile, sessions, errors, vocab, bookmarks and badges', async () => {
    getUserByIdImpl = async () => ({ data: { user: { email: 'me@uni.ac.kr' } } })
    handleQuery = (q) => {
      switch (q.table) {
        case 'profiles':
          return { data: { id: 'u1', role: 'student', created_at: '2026-01-01T00:00:00Z' }, error: null }
        case 'sessions':
          return {
            data: [
              { id: 'se1', class_id: 'c1', chapter_number: 2, draft_error_count: 5, revision_error_count: 1, created_at: '2026-05-01T00:00:00Z' },
            ],
            error: null,
          }
        case 'error_cards':
          return {
            data: [
              {
                id: 'e1', session_id: 'se1', chapter_number: 2, error_type: 'grammar',
                error_subtype: '어순', error_span: 'x', correction: 'y', explanation: 'z',
                fossilization_count: 0, hsk_level: null, created_at: '2026-05-01T00:00:00Z',
              },
            ],
            error: null,
          }
        case 'vocabulary':
          return { data: [{ id: 'v1', chinese: '图书馆', korean: '도서관', created_at: '2026-05-02T00:00:00Z' }], error: null }
        case 'bookmarks':
          return { data: [{ id: 'b1', sentence: '在图书馆看书', created_at: '2026-05-03T00:00:00Z' }], error: null }
        case 'badges':
          return { data: [{ id: 'bg1', badge_type: 'streak_7', earned_at: '2026-05-04T00:00:00Z' }], error: null }
        default:
          return { data: [], error: null }
      }
    }
    const payload = await assembleStudentExport('u1')
    expect(payload.metadata.userId).toBe('u1')
    expect(payload.profile).toEqual({ id: 'u1', email: 'me@uni.ac.kr', role: 'student', createdAt: '2026-01-01T00:00:00Z' })
    expect(payload.sessions[0]).toMatchObject({ id: 'se1', classId: 'c1', chapter: 2, draftErrorCount: 5, sessionErrorCount: 1 })
    expect(payload.errors[0]).toMatchObject({ id: 'e1', errorType: 'grammar', hskLevel: null })
    expect(payload.vocabulary[0]).toMatchObject({ id: 'v1', word: '图书馆', translation: '도서관' })
    expect(payload.bookmarks[0]).toMatchObject({ id: 'b1', content: '在图书馆看书' })
    expect(payload.badges[0]).toMatchObject({ id: 'bg1', badgeType: 'streak_7' })
  })

  it('returns a null profile and empty email when the profile row is missing', async () => {
    getUserByIdImpl = async () => ({ data: { user: null } })
    handleQuery = () => ({ data: null, error: null })
    const payload = await assembleStudentExport('u1')
    expect(payload.profile).toBeNull()
    expect(payload.errors).toEqual([])
    expect(payload.badges).toEqual([])
  })

  it('swallows a badge query error and returns no badges', async () => {
    handleQuery = (q) => {
      if (q.table === 'profiles')
        return { data: { id: 'u1', role: 'student', created_at: '2026-01-01T00:00:00Z' }, error: null }
      if (q.table === 'badges') return { data: null, error: { message: 'badge boom' } }
      return { data: [], error: null }
    }
    const payload = await assembleStudentExport('u1')
    expect(payload.badges).toEqual([])
    expect(payload.profile).not.toBeNull()
  })
})
