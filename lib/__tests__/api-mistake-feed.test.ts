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

vi.mock('@/lib/mistake-feed', () => ({
  submitMistake: vi.fn(),
  setMistakePublic: vi.fn(),
}))

import { POST } from '@/app/api/mistake-feed/route'
import { PATCH } from '@/app/api/mistake-feed/[id]/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { submitMistake, setMistakePublic } from '@/lib/mistake-feed'

const UUID = '11111111-1111-1111-1111-111111111111'

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/mistake-feed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function patchReq(body: unknown): Request {
  return new Request(`http://localhost/api/mistake-feed/${UUID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/mistake-feed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('정상 등록 → 201 + id, 기본 비공개(isPublic 미지정=false)', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 's1', role: 'student', email: null })
    vi.mocked(submitMistake).mockResolvedValue('new-id')

    const res = await POST(postReq({ originalKo: '발이 넓다', literalZh: '脚很宽' }))
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('new-id')
    expect(submitMistake).toHaveBeenCalledWith('s1', expect.objectContaining({ isPublic: false }))
  })

  it('isPublic=true 명시 동의 → 그대로 전달', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 's1', role: 'student', email: null })
    vi.mocked(submitMistake).mockResolvedValue('id2')
    await POST(postReq({ originalKo: 'a', literalZh: 'b', isPublic: true }))
    expect(submitMistake).toHaveBeenCalledWith('s1', expect.objectContaining({ isPublic: true }))
  })

  it('필수 필드 누락 → 400', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 's1', role: 'student', email: null })
    const res = await POST(postReq({ originalKo: '', literalZh: '脚很宽' }))
    expect(res.status).toBe(400)
    expect(submitMistake).not.toHaveBeenCalled()
  })

  it('인증 실패 → status 그대로', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
    const res = await POST(postReq({ originalKo: 'a', literalZh: 'b' }))
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/mistake-feed/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('공개 토글 → 200', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 's1', role: 'student', email: null })
    vi.mocked(setMistakePublic).mockResolvedValue()
    const res = await PATCH(patchReq({ isPublic: true }), { params: Promise.resolve({ id: UUID }) })
    expect(res.status).toBe(200)
    expect(setMistakePublic).toHaveBeenCalledWith('s1', UUID, true)
  })

  it('isPublic 이 boolean 이 아니면 → 400', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 's1', role: 'student', email: null })
    const res = await PATCH(patchReq({ isPublic: 'yes' }), { params: Promise.resolve({ id: UUID }) })
    expect(res.status).toBe(400)
  })

  it('잘못된 id → 400', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 's1', role: 'student', email: null })
    const res = await PATCH(patchReq({ isPublic: true }), { params: Promise.resolve({ id: 'bad' }) })
    expect(res.status).toBe(400)
  })
})
