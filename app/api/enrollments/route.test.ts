import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// 인증/관리자 클라이언트 모의 — 라우트가 import 하는 경로 그대로 가로챈다.
// vi.mock 은 호이스팅되므로 클래스는 vi.hoisted 로 끌어올려 팩토리와 테스트가 공유한다.
const { MockAuthError } = vi.hoisted(() => {
  class MockAuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return { MockAuthError }
})

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  AuthError: MockAuthError,
}))

let classResult: { data: unknown; error: unknown } = { data: null, error: null }
let existingResult: { data: unknown; error: unknown } = { data: null, error: null }
let insertResult: { error: unknown } = { error: null }

function builder(table: string) {
  const b: Record<string, unknown> = {
    select: () => b,
    ilike: () => b,
    eq: () => b,
    maybeSingle: () =>
      Promise.resolve(table === 'classes' ? classResult : existingResult),
    insert: () => Promise.resolve(insertResult),
  }
  return b
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({ from: (t: string) => builder(t) }),
}))

import { POST } from './route'
import { requireAuth } from '@/lib/auth'

function req(body: unknown, raw = false) {
  return new Request('http://localhost/api/enrollments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(requireAuth as Mock).mockResolvedValue({ userId: 'u1', role: 'student' })
  classResult = { data: { id: 'c1', name: '중급 작문', is_active: true }, error: null }
  existingResult = { data: null, error: null }
  insertResult = { error: null }
})

describe('POST /api/enrollments', () => {
  it('returns the AuthError status when not an authenticated student', async () => {
    ;(requireAuth as Mock).mockRejectedValue(new MockAuthError('학생만', 403))
    const res = await POST(req({ inviteCode: 'ERR-1' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid JSON with 400', async () => {
    const res = await POST(req('not-json', true))
    expect(res.status).toBe(400)
  })

  it('rejects a blank invite code with 400', async () => {
    const res = await POST(req({ inviteCode: '   ' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no class matches the code', async () => {
    classResult = { data: null, error: null }
    const res = await POST(req({ inviteCode: 'NOPE' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 for an inactive class', async () => {
    classResult = { data: { id: 'c1', name: '종료반', is_active: false }, error: null }
    const res = await POST(req({ inviteCode: 'OLD' }))
    expect(res.status).toBe(409)
  })

  it('is idempotent when already enrolled (200, alreadyEnrolled)', async () => {
    existingResult = { data: { id: 'enr1' }, error: null }
    const res = await POST(req({ inviteCode: 'ERR-1' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      classId: 'c1',
      alreadyEnrolled: true,
    })
  })

  it('enrolls a new student (201, alreadyEnrolled=false)', async () => {
    const res = await POST(req({ inviteCode: 'err-1' }))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({
      classId: 'c1',
      className: '중급 작문',
      alreadyEnrolled: false,
    })
  })

  it('returns 500 when the insert fails', async () => {
    insertResult = { error: { message: 'boom' } }
    const res = await POST(req({ inviteCode: 'ERR-1' }))
    expect(res.status).toBe(500)
  })
})
