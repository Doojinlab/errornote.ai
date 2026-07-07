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

// createAdminClient 로 classes 조회 → enrollments 중복확인 → enrollments insert 순으로 진행.
const clsResult: { data: unknown; error: { message: string } | null } = { data: null, error: null }
const existingResult: { data: unknown } = { data: null }
const insertResult: { error: { message: string } | null } = { error: null }

function classesBuilder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain,
    ilike: chain,
    eq: chain,
    maybeSingle: () => Promise.resolve(clsResult)
  })
  return b
}

function enrollmentsBuilder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain,
    eq: chain,
    insert: chain,
    // 중복확인은 maybeSingle, insert 는 await(then) 로 소비된다.
    maybeSingle: () => Promise.resolve(existingResult),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(insertResult).then(resolve)
  })
  return b
}

vi.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'classes') return classesBuilder()
      if (table === 'enrollments') return enrollmentsBuilder()
      throw new Error(`unexpected table: ${table}`)
    }
  })
}))

import { POST } from '@/app/api/enrollments/route'
import { requireAuth, AuthError } from '@/lib/auth'

const STUDENT_ID = 'student-1'
const CLASS_ID = 'class-1'

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/enrollments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('POST /api/enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clsResult.data = null
    clsResult.error = null
    existingResult.data = null
    insertResult.error = null
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
  })

  it('초대코드로 신규 등록 → 201', async () => {
    clsResult.data = { id: CLASS_ID, name: '중급 작문', is_active: true }
    const res = await POST(postRequest({ inviteCode: 'ABC123' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.classId).toBe(CLASS_ID)
    expect(body.className).toBe('중급 작문')
    expect(body.alreadyEnrolled).toBe(false)
  })

  it('snake_case invite_code 도 허용 → 201', async () => {
    clsResult.data = { id: CLASS_ID, name: '중급 작문', is_active: true }
    const res = await POST(postRequest({ invite_code: 'ABC123' }))
    expect(res.status).toBe(201)
  })

  it('이미 등록됨 → 멱등(alreadyEnrolled:true)', async () => {
    clsResult.data = { id: CLASS_ID, name: '중급 작문', is_active: true }
    existingResult.data = { id: 'enr-1' }
    const res = await POST(postRequest({ inviteCode: 'ABC123' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyEnrolled).toBe(true)
  })

  it('코드에 해당하는 수업 없음 → 404', async () => {
    clsResult.data = null
    const res = await POST(postRequest({ inviteCode: 'NOPE' }))
    expect(res.status).toBe(404)
  })

  it('종료된 수업(is_active:false) → 409', async () => {
    clsResult.data = { id: CLASS_ID, name: '지난 학기', is_active: false }
    const res = await POST(postRequest({ inviteCode: 'OLD' }))
    expect(res.status).toBe(409)
  })

  it('초대코드 누락 → 400', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
  })

  it('잘못된 JSON → 400', async () => {
    const res = await POST(postRequest('{bad'))
    expect(res.status).toBe(400)
  })

  it('class 조회 오류 → 500', async () => {
    clsResult.error = { message: 'lookup fail' }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postRequest({ inviteCode: 'ABC123' }))
    errSpy.mockRestore()
    expect(res.status).toBe(500)
  })

  it('insert 오류 → 500', async () => {
    clsResult.data = { id: CLASS_ID, name: '중급 작문', is_active: true }
    insertResult.error = { message: 'insert fail' }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postRequest({ inviteCode: 'ABC123' }))
    errSpy.mockRestore()
    expect(res.status).toBe(500)
  })

  it('학생 권한 아님(403) → status 그대로', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
    const res = await POST(postRequest({ inviteCode: 'ABC123' }))
    expect(res.status).toBe(403)
  })
})
