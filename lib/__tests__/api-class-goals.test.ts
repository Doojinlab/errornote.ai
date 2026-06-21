import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// createServerClient 는 입력 검증 통과 후에만 호출되므로, 검증 실패 케이스는 DB 무관.
const insertSingle = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'sp1' }, error: null }) }) }),
      insert: () => ({ select: () => ({ single: insertSingle }) }),
    }),
  }),
}))

import { POST } from '@/app/api/class-goals/route'
import { requireAuth, AuthError } from '@/lib/auth'

function req(body: unknown): Request {
  return new Request('http://localhost/api/class-goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID = {
  classId: '11111111-1111-1111-1111-111111111111',
  speciesCode: 'ba_construction',
  targetCount: 30,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
}

describe('POST /api/class-goals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'prof1', role: 'professor', email: null })
    insertSingle.mockResolvedValue({
      data: { id: 'g1', ...VALID, current_count: 0, achieved: false },
      error: null,
    })
  })

  it('정상 입력 → 201', async () => {
    const res = await POST(req(VALID))
    expect(res.status).toBe(201)
  })

  it('targetCount 가 0 이하 → 400', async () => {
    const res = await POST(req({ ...VALID, targetCount: 0 }))
    expect(res.status).toBe(400)
  })

  it('기간 역전(end < start) → 400', async () => {
    const res = await POST(req({ ...VALID, periodStart: '2026-06-30', periodEnd: '2026-06-01' }))
    expect(res.status).toBe(400)
  })

  it('날짜 형식 오류 → 400', async () => {
    const res = await POST(req({ ...VALID, periodStart: '2026/06/01' }))
    expect(res.status).toBe(400)
  })

  it('classId/speciesCode 누락 → 400', async () => {
    const res = await POST(req({ ...VALID, classId: '' }))
    expect(res.status).toBe(400)
  })

  it('교수 권한 아님 → AuthError status', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('professor 권한이 필요합니다', 403))
    const res = await POST(req(VALID))
    expect(res.status).toBe(403)
  })
})
