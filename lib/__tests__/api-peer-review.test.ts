import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 공용 lib 모킹 (실제 lib/* 파일은 수정하지 않음) ───────────────────────────────

vi.mock('@/lib/auth', () => {
  class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }
  return { AuthError, requireAuth: vi.fn() }
})

vi.mock('@/lib/peer-review', () => {
  class PeerReviewAccessError extends Error {
    status = 403
    constructor(message = '해당 수업에 대한 권한이 없습니다') {
      super(message)
      this.name = 'PeerReviewAccessError'
    }
  }
  return {
    PeerReviewAccessError,
    createReviewRequest: vi.fn(),
    listAssignedReviews: vi.fn(),
    listReceivedReviews: vi.fn(),
    listClassPeerReviews: vi.fn(),
    updateReview: vi.fn()
  }
})

import { GET, POST } from '@/app/api/peer-review/route'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  PeerReviewAccessError,
  createReviewRequest,
  listAssignedReviews,
  listReceivedReviews,
  listClassPeerReviews,
  updateReview
} from '@/lib/peer-review'

const STUDENT_ID = 'student-1'
const PROF_ID = 'prof-1'
const VALID_UUID = '11111111-1111-1111-1111-111111111111'

function getRequest(url = 'http://localhost/api/peer-review'): Request {
  return new Request(url, { method: 'GET' })
}
function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/peer-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('/api/peer-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
    vi.mocked(listAssignedReviews).mockResolvedValue([])
    vi.mocked(listReceivedReviews).mockResolvedValue([])
    vi.mocked(listClassPeerReviews).mockResolvedValue([] as never)
  })

  describe('GET', () => {
    it('학생 → assigned/received 반환', async () => {
      vi.mocked(listAssignedReviews).mockResolvedValue([{ review_id: 'r1' }] as never)
      vi.mocked(listReceivedReviews).mockResolvedValue([{ request_id: 'q1' }] as never)
      const res = await GET(getRequest())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.assigned).toHaveLength(1)
      expect(body.received).toHaveLength(1)
    })

    it('교수 + class_id 없음 → 400', async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: PROF_ID, role: 'professor', email: null })
      const res = await GET(getRequest())
      expect(res.status).toBe(400)
    })

    it('교수 + 유효한 class_id → 200 data', async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: PROF_ID, role: 'professor', email: null })
      vi.mocked(listClassPeerReviews).mockResolvedValue([{ id: 'x' }] as never)
      const res = await GET(getRequest(`http://localhost/api/peer-review?class_id=${VALID_UUID}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(listClassPeerReviews).toHaveBeenCalledWith(VALID_UUID, PROF_ID)
    })

    it('교수 권한 오류(PeerReviewAccessError) → 403', async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: PROF_ID, role: 'professor', email: null })
      vi.mocked(listClassPeerReviews).mockRejectedValue(new PeerReviewAccessError())
      const res = await GET(getRequest(`http://localhost/api/peer-review?class_id=${VALID_UUID}`))
      expect(res.status).toBe(403)
    })

    it('미인증(401) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await GET(getRequest())
      expect(res.status).toBe(401)
    })

    it('예기치 못한 오류 → 500', async () => {
      vi.mocked(listAssignedReviews).mockRejectedValue(new Error('db down'))
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await GET(getRequest())
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('type=request + 유효 assignment_id → 201', async () => {
      vi.mocked(createReviewRequest).mockResolvedValue({ review_id: 'r-new' } as never)
      const res = await POST(postRequest({ type: 'request', assignment_id: VALID_UUID }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.review_id).toBe('r-new')
      expect(createReviewRequest).toHaveBeenCalledWith(STUDENT_ID, VALID_UUID)
    })

    it('type=request + 유효하지 않은 assignment_id → 400', async () => {
      const res = await POST(postRequest({ type: 'request', assignment_id: 'not-uuid' }))
      expect(res.status).toBe(400)
    })

    it('type=request + 도메인 오류 → 400', async () => {
      vi.mocked(createReviewRequest).mockRejectedValue(new Error('이미 신청했습니다'))
      const res = await POST(postRequest({ type: 'request', assignment_id: VALID_UUID }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/이미 신청/)
    })

    it('type=submit + 유효 review_id → 200', async () => {
      vi.mocked(updateReview).mockResolvedValue({ id: 'r1', status: 'completed' } as never)
      const res = await POST(
        postRequest({
          type: 'submit',
          review_id: VALID_UUID,
          feedback_text: '좋아요',
          grammar_score: 8,
          vocab_score: 7,
          content_score: 9,
          overall_score: 8
        })
      )
      expect(res.status).toBe(200)
      expect(updateReview).toHaveBeenCalledWith(
        VALID_UUID,
        STUDENT_ID,
        expect.objectContaining({ status: 'completed', grammar_score: 8 })
      )
    })

    it('type=submit + 유효하지 않은 review_id → 400', async () => {
      const res = await POST(postRequest({ type: 'submit', review_id: 'nope' }))
      expect(res.status).toBe(400)
    })

    it('알 수 없는 type → 400', async () => {
      const res = await POST(postRequest({ type: 'delete' }))
      expect(res.status).toBe(400)
    })

    it('잘못된 JSON → 400', async () => {
      const res = await POST(postRequest('{bad'))
      expect(res.status).toBe(400)
    })

    it('학생 권한 아님(403) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
      const res = await POST(postRequest({ type: 'request', assignment_id: VALID_UUID }))
      expect(res.status).toBe(403)
    })
  })
})
