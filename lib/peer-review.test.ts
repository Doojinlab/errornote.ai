import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PeerReviewAccessError,
  createReviewRequest,
  listAssignedReviews,
  listReceivedReviews,
  getReviewDetail,
  updateReview,
  listClassPeerReviews,
} from './peer-review'

// ── Supabase(admin) 모의 ──────────────────────────────────────────────────────
// peer-review 는 여러 테이블을 select/insert/update 로 섞어 호출한다.
// 테이블·연산(op)·단건여부(single)·필터를 기록하는 handler 기반 빌더를 쓴다.
interface QueryShape {
  table: string
  op: 'select' | 'insert' | 'update'
  single: boolean
  filters: Array<[string, string, unknown]>
  payload?: unknown
}
type QueryResult = { data?: unknown; error?: unknown }

let handleQuery: (q: QueryShape) => QueryResult = () => ({ data: null, error: null })
const inserts: Array<{ table: string; payload: unknown }> = []

function makeBuilder(table: string) {
  const q: QueryShape = { table, op: 'select', single: false, filters: [] }
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (payload: unknown) => {
      q.op = 'insert'
      q.payload = payload
      inserts.push({ table, payload })
      return b
    },
    update: (payload: unknown) => {
      q.op = 'update'
      q.payload = payload
      return b
    },
    eq: (c: string, v: unknown) => {
      q.filters.push(['eq', c, v])
      return b
    },
    neq: (c: string, v: unknown) => {
      q.filters.push(['neq', c, v])
      return b
    },
    in: (c: string, v: unknown) => {
      q.filters.push(['in', c, v])
      return b
    },
    order: () => b,
    limit: () => b,
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

beforeEach(() => {
  handleQuery = () => ({ data: null, error: null })
  inserts.length = 0
})

describe('PeerReviewAccessError', () => {
  it('carries a 403 status and a default message', () => {
    const e = new PeerReviewAccessError()
    expect(e.status).toBe(403)
    expect(e.name).toBe('PeerReviewAccessError')
    expect(e.message).toContain('권한')
  })
})

describe('createReviewRequest', () => {
  const base = (over: Partial<Record<string, QueryResult>> = {}) => {
    const map: Record<string, QueryResult> = {
      assignments: { data: { id: 'a1', class_id: 'c1' }, error: null },
      sessions: { data: { id: 'se1', draft_text: '제출 초안' }, error: null },
      peer_review_requests_select: { data: null, error: null },
      peer_review_requests_insert: { data: { id: 'req1', assignment_id: 'a1', requester_id: 's1', status: 'pending', created_at: '2026-06-01T00:00:00Z' }, error: null },
      enrollments: { data: [{ student_id: 's2' }, { student_id: 's3' }, { student_id: 's4' }], error: null },
      peer_reviews: { data: null, error: null },
      ...over,
    }
    handleQuery = (q) => {
      if (q.table === 'peer_review_requests') return map[q.op === 'insert' ? 'peer_review_requests_insert' : 'peer_review_requests_select']
      return map[q.table] ?? { data: null, error: null }
    }
  }

  it('creates a request and assigns up to two reviewers from classmates', async () => {
    base()
    const req = await createReviewRequest('s1', 'a1')
    expect(req.id).toBe('req1')
    const reviewerInsert = inserts.find((i) => i.table === 'peer_reviews')
    expect(reviewerInsert).toBeDefined()
    expect(reviewerInsert!.payload as unknown[]).toHaveLength(2) // REVIEWERS_PER_REQUEST
  })

  it('throws when the assignment does not exist', async () => {
    base({ assignments: { data: null, error: null } })
    await expect(createReviewRequest('s1', 'a1')).rejects.toThrow(/과제를 찾을 수 없습니다/)
  })

  it('throws when the student has not submitted a draft', async () => {
    base({ sessions: { data: { id: 'se1', draft_text: null }, error: null } })
    await expect(createReviewRequest('s1', 'a1')).rejects.toThrow(/먼저 제출/)
  })

  it('throws when a request already exists', async () => {
    base({ peer_review_requests_select: { data: { id: 'req0' }, error: null } })
    await expect(createReviewRequest('s1', 'a1')).rejects.toThrow(/이미 동료 피드백/)
  })

  it('creates the request but assigns no reviewers when there are no classmates', async () => {
    base({ enrollments: { data: [], error: null } })
    const req = await createReviewRequest('s1', 'a1')
    expect(req.id).toBe('req1')
    expect(inserts.find((i) => i.table === 'peer_reviews')).toBeUndefined()
  })

  it('throws when the request insert fails', async () => {
    base({ peer_review_requests_insert: { data: null, error: { message: 'boom' } } })
    await expect(createReviewRequest('s1', 'a1')).rejects.toThrow(/리뷰 요청 생성 실패/)
  })
})

describe('listAssignedReviews', () => {
  it('flattens the nested assignment title', async () => {
    handleQuery = () => ({
      data: [
        {
          id: 'rv1', request_id: 'req1', status: 'pending', created_at: '2026-06-01T00:00:00Z',
          peer_review_requests: { assignments: { title: '주간 작문' } },
        },
      ],
      error: null,
    })
    const list = await listAssignedReviews('s2')
    expect(list[0]).toEqual({ review_id: 'rv1', request_id: 'req1', status: 'pending', created_at: '2026-06-01T00:00:00Z', assignment_title: '주간 작문' })
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'boom' } })
    await expect(listAssignedReviews('s2')).rejects.toThrow(/배정 리뷰 조회 실패/)
  })
})

describe('listReceivedReviews', () => {
  it('maps requests and nested reviews without exposing reviewer identity', async () => {
    handleQuery = () => ({
      data: [
        {
          id: 'req1', assignment_id: 'a1', status: 'in_progress', created_at: '2026-06-01T00:00:00Z',
          assignments: { title: '주간 작문' },
          peer_reviews: [
            { id: 'rv1', feedback_text: '좋아요', grammar_score: 8, vocab_score: 7, content_score: 9, overall_score: 8, status: 'completed', completed_at: '2026-06-02T00:00:00Z' },
          ],
        },
      ],
      error: null,
    })
    const list = await listReceivedReviews('s1')
    expect(list[0].request_id).toBe('req1')
    expect(list[0].assignment_title).toBe('주간 작문')
    expect(list[0].reviews[0].id).toBe('rv1')
    expect(list[0].reviews[0]).not.toHaveProperty('reviewer_id')
  })

  it('defaults missing reviews to an empty array', async () => {
    handleQuery = () => ({
      data: [{ id: 'req1', assignment_id: 'a1', status: 'pending', created_at: '2026-06-01T00:00:00Z', assignments: { title: 't' }, peer_reviews: null }],
      error: null,
    })
    const list = await listReceivedReviews('s1')
    expect(list[0].reviews).toEqual([])
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'boom' } })
    await expect(listReceivedReviews('s1')).rejects.toThrow(/받은 리뷰 조회 실패/)
  })
})

describe('getReviewDetail', () => {
  const wire = (over: Partial<Record<string, QueryResult>> = {}) => {
    const map: Record<string, QueryResult> = {
      peer_reviews: { data: { id: 'rv1', request_id: 'req1', reviewer_id: 's2', status: 'in_progress', feedback_text: null, grammar_score: null, vocab_score: null, content_score: null, overall_score: null, completed_at: null }, error: null },
      peer_review_requests: { data: { assignment_id: 'a1', requester_id: 's1' }, error: null },
      assignments: { data: { title: '주간 작문', prompt_text: '도서관에 대해' }, error: null },
      sessions: { data: { draft_text: '익명 초안' }, error: null },
      ...over,
    }
    handleQuery = (q) => map[q.table] ?? { data: null, error: null }
  }

  it('returns the anonymous draft plus assignment context', async () => {
    wire()
    const detail = await getReviewDetail('rv1', 's2')
    expect(detail.review_id).toBe('rv1')
    expect(detail.assignment_title).toBe('주간 작문')
    expect(detail.prompt_text).toBe('도서관에 대해')
    expect(detail.draft_text).toBe('익명 초안')
  })

  it('throws when the review is missing or not owned by the reviewer', async () => {
    wire({ peer_reviews: { data: null, error: null } })
    await expect(getReviewDetail('rv1', 's2')).rejects.toThrow(/권한이 없거나/)
  })

  it('throws when the parent request is missing', async () => {
    wire({ peer_review_requests: { data: null, error: null } })
    await expect(getReviewDetail('rv1', 's2')).rejects.toThrow(/리뷰 요청을 찾을 수 없습니다/)
  })

  it('falls back to empty strings when the assignment/session are absent', async () => {
    wire({ assignments: { data: null, error: null }, sessions: { data: null, error: null } })
    const detail = await getReviewDetail('rv1', 's2')
    expect(detail.assignment_title).toBe('')
    expect(detail.prompt_text).toBe('')
    expect(detail.draft_text).toBeNull()
  })
})

describe('updateReview', () => {
  const full = { feedback_text: '잘했어요', grammar_score: 8, vocab_score: 7, content_score: 9, overall_score: 8 as const }

  it('saves an in-progress draft without requiring all fields', async () => {
    let patch: Record<string, unknown> | undefined
    handleQuery = (q) => {
      if (q.table === 'peer_reviews' && q.op === 'select' && q.single) return { data: { id: 'rv1', status: 'pending', request_id: 'req1' }, error: null }
      if (q.table === 'peer_reviews' && q.op === 'update') {
        patch = q.payload as Record<string, unknown>
        return { data: { id: 'rv1', status: 'in_progress' }, error: null }
      }
      return { data: null, error: null }
    }
    const res = await updateReview('rv1', 's2', { feedback_text: '진행 중', status: 'in_progress' })
    expect(res.id).toBe('rv1')
    expect(patch).toMatchObject({ feedback_text: '진행 중', status: 'in_progress' })
    expect(patch).not.toHaveProperty('completed_at')
  })

  it('rejects completing without every score and feedback', async () => {
    handleQuery = (q) =>
      q.op === 'select' && q.single ? { data: { id: 'rv1', status: 'pending', request_id: 'req1' }, error: null } : { data: null, error: null }
    await expect(updateReview('rv1', 's2', { feedback_text: '', status: 'completed' })).rejects.toThrow(/모든 점수 항목/)
  })

  it('completes the review, stamps completed_at and syncs the request status', async () => {
    let requestPatch: Record<string, unknown> | undefined
    handleQuery = (q) => {
      if (q.table === 'peer_reviews' && q.op === 'select' && q.single) return { data: { id: 'rv1', status: 'in_progress', request_id: 'req1' }, error: null }
      if (q.table === 'peer_reviews' && q.op === 'update') return { data: { id: 'rv1', status: 'completed' }, error: null }
      if (q.table === 'peer_reviews' && q.op === 'select' && !q.single) return { data: [{ status: 'completed' }, { status: 'completed' }], error: null }
      if (q.table === 'peer_review_requests' && q.op === 'update') {
        requestPatch = q.payload as Record<string, unknown>
        return { data: null, error: null }
      }
      return { data: null, error: null }
    }
    const res = await updateReview('rv1', 's2', { ...full, status: 'completed' })
    expect(res.status).toBe('completed')
    expect(requestPatch).toEqual({ status: 'completed' }) // 모두 완료 → request 도 completed
  })

  it('throws when the review is not found', async () => {
    handleQuery = () => ({ data: null, error: null })
    await expect(updateReview('rv1', 's2', { status: 'in_progress' })).rejects.toThrow(/권한이 없거나/)
  })

  it('rejects editing an already-completed review', async () => {
    handleQuery = () => ({ data: { id: 'rv1', status: 'completed', request_id: 'req1' }, error: null })
    await expect(updateReview('rv1', 's2', { status: 'in_progress' })).rejects.toThrow(/이미 완료된/)
  })
})

describe('listClassPeerReviews', () => {
  it('throws PeerReviewAccessError when the professor does not own the class', async () => {
    handleQuery = (q) => (q.table === 'classes' ? { data: null, error: null } : { data: null, error: null })
    await expect(listClassPeerReviews('c1', 'prof-x')).rejects.toBeInstanceOf(PeerReviewAccessError)
  })

  it('returns an empty array when the class has no assignments', async () => {
    handleQuery = (q) => {
      if (q.table === 'classes') return { data: { id: 'c1' }, error: null }
      if (q.table === 'assignments') return { data: [], error: null }
      return { data: null, error: null }
    }
    expect(await listClassPeerReviews('c1', 'p1')).toEqual([])
  })

  it('returns the review requests for the class assignments', async () => {
    handleQuery = (q) => {
      if (q.table === 'classes') return { data: { id: 'c1' }, error: null }
      if (q.table === 'assignments') return { data: [{ id: 'a1', title: 't' }], error: null }
      if (q.table === 'peer_review_requests') return { data: [{ id: 'req1', assignment_id: 'a1' }], error: null }
      return { data: null, error: null }
    }
    const rows = (await listClassPeerReviews('c1', 'p1')) as Array<{ id: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('req1')
  })

  it('throws when the assignment query errors', async () => {
    handleQuery = (q) => {
      if (q.table === 'classes') return { data: { id: 'c1' }, error: null }
      if (q.table === 'assignments') return { data: null, error: { message: 'boom' } }
      return { data: null, error: null }
    }
    await expect(listClassPeerReviews('c1', 'p1')).rejects.toThrow(/수업 과제 조회 실패/)
  })
})
