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

vi.mock('@/lib/marketplace', () => ({
  updatePublishState: vi.fn()
}))

import { POST } from '@/app/api/marketplace/publish/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { updatePublishState } from '@/lib/marketplace'

const PROF_ID = 'prof-1'
const DOC_ID = 'doc-1'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/marketplace/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('POST /api/marketplace/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ userId: PROF_ID, role: 'professor', email: null })
    vi.mocked(updatePublishState).mockResolvedValue(undefined as never)
  })

  it('공개 전환 정상 → ok:true, professor 권한으로 호출', async () => {
    const res = await POST(postRequest({ id: DOC_ID, is_public: true, title: '공유 코퍼스', description: '설명' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(requireAuth).toHaveBeenCalledWith('professor')
    expect(updatePublishState).toHaveBeenCalledWith(
      PROF_ID,
      expect.objectContaining({ id: DOC_ID, is_public: true, title: '공유 코퍼스', description: '설명' })
    )
  })

  it('비공개 전환(is_public:false) 정상 → ok:true', async () => {
    const res = await POST(postRequest({ id: DOC_ID, is_public: false }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('학생 권한(403) → status 그대로, updatePublishState 미호출', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('professor 권한이 필요합니다', 403))
    const res = await POST(postRequest({ id: DOC_ID, is_public: true }))
    expect(res.status).toBe(403)
    expect(updatePublishState).not.toHaveBeenCalled()
  })

  it('잘못된 JSON → 400', async () => {
    const res = await POST(postRequest('{bad'))
    expect(res.status).toBe(400)
  })

  it('id 누락 → 400', async () => {
    const res = await POST(postRequest({ is_public: true }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/id/)
  })

  it('is_public 이 boolean 이 아님 → 400', async () => {
    const res = await POST(postRequest({ id: DOC_ID, is_public: 'yes' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/boolean/)
  })

  it('updatePublishState 예외 → 500', async () => {
    vi.mocked(updatePublishState).mockRejectedValue(new Error('소유자가 아닙니다'))
    const res = await POST(postRequest({ id: DOC_ID, is_public: true }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/소유자/)
  })
})
