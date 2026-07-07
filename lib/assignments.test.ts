import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAssignment,
  getRubric,
  listAssignmentsForClass,
  listMyRubrics,
  listAssignmentsForStudent,
  listSubmissions,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  saveRubricEvaluation,
} from './assignments'

// ── Supabase 모의 ─────────────────────────────────────────────────────────────
// 테이블·연산(op)·필터·단건여부(single)를 기록하는 handler 기반 빌더.
interface QueryShape {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  single: boolean
  filters: Array<[string, string, unknown]>
  payload?: unknown
}
type QueryResult = { data?: unknown; error?: unknown }

let handleQuery: (q: QueryShape) => QueryResult = () => ({ data: null, error: null })

function makeBuilder(table: string) {
  const q: QueryShape = { table, op: 'select', single: false, filters: [] }
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (payload: unknown) => {
      q.op = 'insert'
      q.payload = payload
      return b
    },
    update: (payload: unknown) => {
      q.op = 'update'
      q.payload = payload
      return b
    },
    delete: () => {
      q.op = 'delete'
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

const mockSupabase = { from: (table: string) => makeBuilder(table) }

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase,
}))

const assignmentRow = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  class_id: 'c1',
  professor_id: 'p1',
  title: '주간 작문',
  prompt_text: '도서관에 대해 쓰세요',
  due_date: null,
  rubric_id: null,
  created_at: '2026-06-01T00:00:00Z',
  ...over,
})

const rubricRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  professor_id: 'p1',
  name: '기본 루브릭',
  criteria: [{ name: '문법', weight: 100, description: '', max_score: 10 }],
  created_at: '2026-06-01T00:00:00Z',
  ...over,
})

beforeEach(() => {
  handleQuery = () => ({ data: null, error: null })
})

describe('getAssignment', () => {
  it('returns the row on success', async () => {
    handleQuery = () => ({ data: assignmentRow(), error: null })
    const a = await getAssignment('a1')
    expect(a?.id).toBe('a1')
    expect(a?.title).toBe('주간 작문')
  })

  it('returns null when no row is found', async () => {
    handleQuery = () => ({ data: null, error: null })
    expect(await getAssignment('missing')).toBeNull()
  })

  it('throws on a query error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'boom' } })
    await expect(getAssignment('a1')).rejects.toThrow(/assignments 조회 실패: boom/)
  })
})

describe('getRubric', () => {
  it('maps the row and defaults criteria to an array', async () => {
    handleQuery = () => ({ data: rubricRow({ criteria: null }), error: null })
    const r = await getRubric('r1')
    expect(r?.id).toBe('r1')
    expect(r?.criteria).toEqual([])
  })

  it('returns null when missing', async () => {
    handleQuery = () => ({ data: null, error: null })
    expect(await getRubric('x')).toBeNull()
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'nope' } })
    await expect(getRubric('r1')).rejects.toThrow(/rubrics 조회 실패: nope/)
  })
})

describe('listAssignmentsForClass', () => {
  it('returns the array of assignments', async () => {
    handleQuery = () => ({ data: [assignmentRow(), assignmentRow({ id: 'a2' })], error: null })
    const list = await listAssignmentsForClass('c1')
    expect(list).toHaveLength(2)
    expect(list[1].id).toBe('a2')
  })

  it('returns an empty array when data is null', async () => {
    handleQuery = () => ({ data: null, error: null })
    expect(await listAssignmentsForClass('c1')).toEqual([])
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'x' } })
    await expect(listAssignmentsForClass('c1')).rejects.toThrow(/assignments 목록 실패/)
  })
})

describe('listMyRubrics', () => {
  it('maps rows, defaulting criteria arrays', async () => {
    handleQuery = () => ({ data: [rubricRow(), rubricRow({ id: 'r2', criteria: null })], error: null })
    const list = await listMyRubrics('p1')
    expect(list).toHaveLength(2)
    expect(list[0].criteria).toHaveLength(1)
    expect(list[1].criteria).toEqual([])
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'x' } })
    await expect(listMyRubrics('p1')).rejects.toThrow(/rubrics 목록 실패/)
  })
})

describe('listAssignmentsForStudent', () => {
  it('returns an empty array when there are no assignments', async () => {
    handleQuery = (q) => (q.table === 'assignments' ? { data: [], error: null } : { data: null, error: null })
    expect(await listAssignmentsForStudent('s1')).toEqual([])
  })

  it('joins the latest session and its rubric score per assignment', async () => {
    handleQuery = (q) => {
      switch (q.table) {
        case 'assignments':
          return { data: [{ ...assignmentRow({ id: 'a1', rubric_id: 'r1' }), rubric: rubricRow() }], error: null }
        case 'sessions':
          return {
            data: [
              { id: 'se-old', assignment_id: 'a1', draft_error_count: 9, created_at: '2026-06-01T00:00:00Z' },
              { id: 'se-new', assignment_id: 'a1', draft_error_count: 3, created_at: '2026-06-05T00:00:00Z' },
              { id: 'se-null', assignment_id: null, draft_error_count: 0, created_at: '2026-06-06T00:00:00Z' },
            ],
            error: null,
          }
        case 'rubric_evaluations':
          return { data: [{ session_id: 'se-new', total_score: 88 }], error: null }
        default:
          return { data: null, error: null }
      }
    }
    const views = await listAssignmentsForStudent('s1')
    expect(views).toHaveLength(1)
    expect(views[0].submitted).toBe(true)
    expect(views[0].session_id).toBe('se-new') // 최신 세션 채택
    expect(views[0].error_count).toBe(3)
    expect(views[0].total_score).toBe(88)
    expect(views[0].rubric?.id).toBe('r1')
  })

  it('marks assignments without a session as not submitted', async () => {
    handleQuery = (q) => {
      if (q.table === 'assignments')
        return { data: [{ ...assignmentRow({ id: 'a1' }), rubric: null }], error: null }
      if (q.table === 'sessions') return { data: [], error: null }
      return { data: null, error: null }
    }
    const views = await listAssignmentsForStudent('s1')
    expect(views[0].submitted).toBe(false)
    expect(views[0].total_score).toBeNull()
    expect(views[0].rubric).toBeNull()
  })

  it('throws when the assignment query errors', async () => {
    handleQuery = (q) => (q.table === 'assignments' ? { data: null, error: { message: 'boom' } } : { data: null, error: null })
    await expect(listAssignmentsForStudent('s1')).rejects.toThrow(/student assignments 조회 실패/)
  })
})

describe('listSubmissions', () => {
  it('flattens the first rubric evaluation into each submission', async () => {
    handleQuery = () => ({
      data: [
        {
          id: 'se1',
          student_id: 's1',
          created_at: '2026-06-05T00:00:00Z',
          draft_text: '초안',
          draft_error_count: 4,
          revision_error_count: 1,
          profiles: { name: '두진' },
          rubric_evaluations: [{ id: 'ev1', scores: [{ criterion: '문법', score: 8, max_score: 10, feedback: '' }], total_score: 80, ai_feedback: '좋아요' }],
        },
      ],
      error: null,
    })
    const subs = await listSubmissions('a1')
    expect(subs).toHaveLength(1)
    expect(subs[0].student_name).toBe('두진')
    expect(subs[0].evaluation_id).toBe('ev1')
    expect(subs[0].total_score).toBe(80)
    expect(subs[0].scores).toHaveLength(1)
  })

  it('handles missing profile and evaluation gracefully', async () => {
    handleQuery = () => ({
      data: [
        {
          id: 'se1', student_id: 's1', created_at: '2026-06-05T00:00:00Z',
          draft_text: null, draft_error_count: null, revision_error_count: null,
          profiles: null, rubric_evaluations: null,
        },
      ],
      error: null,
    })
    const subs = await listSubmissions('a1')
    expect(subs[0].student_name).toBeNull()
    expect(subs[0].evaluation_id).toBeNull()
    expect(subs[0].scores).toBeNull()
    expect(subs[0].total_score).toBeNull()
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'x' } })
    await expect(listSubmissions('a1')).rejects.toThrow(/제출물 조회 실패/)
  })
})

describe('createAssignment', () => {
  it('inserts with defaulted nullable fields and returns the row', async () => {
    let captured: Record<string, unknown> | undefined
    handleQuery = (q) => {
      captured = q.payload as Record<string, unknown>
      return { data: assignmentRow(), error: null }
    }
    const a = await createAssignment('p1', { class_id: 'c1', title: 't', prompt_text: 'p' })
    expect(a.id).toBe('a1')
    expect(captured).toMatchObject({ class_id: 'c1', professor_id: 'p1', due_date: null, rubric_id: null })
  })

  it('throws when insert returns no row', async () => {
    handleQuery = () => ({ data: null, error: { message: 'dup' } })
    await expect(createAssignment('p1', { class_id: 'c1', title: 't', prompt_text: 'p' })).rejects.toThrow(/insert 실패: dup/)
  })
})

describe('updateAssignment', () => {
  it('builds a patch only from defined fields', async () => {
    let captured: Record<string, unknown> | undefined
    handleQuery = (q) => {
      captured = q.payload as Record<string, unknown>
      return { data: assignmentRow({ title: '수정됨' }), error: null }
    }
    const a = await updateAssignment('a1', { title: '수정됨' })
    expect(a.title).toBe('수정됨')
    expect(captured).toEqual({ title: '수정됨' }) // prompt_text/due_date/rubric_id 제외
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'x' } })
    await expect(updateAssignment('a1', { title: 't' })).rejects.toThrow(/update 실패/)
  })
})

describe('deleteAssignment', () => {
  it('resolves on success', async () => {
    handleQuery = () => ({ error: null })
    await expect(deleteAssignment('a1')).resolves.toBeUndefined()
  })

  it('throws on error', async () => {
    handleQuery = () => ({ error: { message: 'x' } })
    await expect(deleteAssignment('a1')).rejects.toThrow(/delete 실패/)
  })
})

describe('saveRubricEvaluation', () => {
  const params = {
    sessionId: 'se1',
    rubricId: 'r1',
    scores: [{ criterion: '문법', score: 8, max_score: 10, feedback: '' }],
    totalScore: 80,
    aiFeedback: '좋아요',
  }

  it('updates the existing evaluation and returns its id', async () => {
    const ops: string[] = []
    handleQuery = (q) => {
      if (q.table === 'rubric_evaluations') {
        ops.push(q.op)
        if (q.op === 'select') return { data: { id: 'ev-existing' }, error: null }
        return { data: null, error: null } // update
      }
      return { data: null, error: null }
    }
    const id = await saveRubricEvaluation(params)
    expect(id).toBe('ev-existing')
    expect(ops).toContain('update')
  })

  it('inserts a new evaluation when none exists', async () => {
    handleQuery = (q) => {
      if (q.op === 'select') return { data: null, error: null }
      if (q.op === 'insert') return { data: { id: 'ev-new' }, error: null }
      return { data: null, error: null }
    }
    const id = await saveRubricEvaluation(params)
    expect(id).toBe('ev-new')
  })

  it('throws when the update fails', async () => {
    handleQuery = (q) => {
      if (q.op === 'select') return { data: { id: 'ev1' }, error: null }
      return { data: null, error: { message: 'boom' } }
    }
    await expect(saveRubricEvaluation(params)).rejects.toThrow(/update 실패: boom/)
  })

  it('throws when the insert fails', async () => {
    handleQuery = (q) => {
      if (q.op === 'select') return { data: null, error: null }
      return { data: null, error: { message: 'boom' } }
    }
    await expect(saveRubricEvaluation(params)).rejects.toThrow(/insert 실패: boom/)
  })
})
