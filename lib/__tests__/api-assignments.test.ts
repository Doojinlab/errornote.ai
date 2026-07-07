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

// createServerClient 는 classes / rubrics 소유권 확인(maybeSingle)에 쓰인다.
const classesResult: { data: unknown } = { data: null }
const rubricsResult: { data: unknown } = { data: null }

function serverBuilder(getResult: () => { data: unknown }) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain,
    eq: chain,
    maybeSingle: () => Promise.resolve(getResult())
  })
  return b
}

// createAdminClient 는 enrollments 목록을 fire-and-forget 로 조회한다.
function adminBuilder() {
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain,
    eq: chain,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [] }).then(resolve)
  })
  return b
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === 'classes') return serverBuilder(() => classesResult)
      if (table === 'rubrics') return serverBuilder(() => rubricsResult)
      throw new Error(`unexpected table: ${table}`)
    }
  }),
  createAdminClient: () => ({
    from: () => adminBuilder()
  })
}))

vi.mock('@/lib/assignments', () => ({
  createAssignment: vi.fn(),
  listAssignmentsForClass: vi.fn(),
  listAssignmentsForStudent: vi.fn()
}))

vi.mock('@/lib/kakao', () => ({
  notifyKakaoEvent: vi.fn().mockResolvedValue(undefined)
}))

import { GET, POST } from '@/app/api/assignments/route'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  createAssignment,
  listAssignmentsForClass,
  listAssignmentsForStudent
} from '@/lib/assignments'

const STUDENT_ID = 'student-1'
const PROF_ID = 'prof-1'
const CLASS_ID = '11111111-1111-1111-1111-111111111111'
const RUBRIC_ID = '22222222-2222-2222-2222-222222222222'

function getRequest(url = 'http://localhost/api/assignments'): Request {
  return new Request(url, { method: 'GET' })
}
function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/assignments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('/api/assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    classesResult.data = null
    rubricsResult.data = null
    vi.mocked(requireAuth).mockResolvedValue({ userId: PROF_ID, role: 'professor', email: null })
    vi.mocked(listAssignmentsForClass).mockResolvedValue([])
    vi.mocked(listAssignmentsForStudent).mockResolvedValue([])
    vi.mocked(createAssignment).mockResolvedValue({ id: 'a-new', title: '주말 일기' } as never)
  })

  describe('GET', () => {
    it('교수 + 유효 classId → 목록', async () => {
      vi.mocked(listAssignmentsForClass).mockResolvedValue([{ id: 'a1' }] as never)
      const res = await GET(getRequest(`http://localhost/api/assignments?classId=${CLASS_ID}`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.items).toHaveLength(1)
      expect(listAssignmentsForClass).toHaveBeenCalledWith(CLASS_ID)
    })

    it('교수 + classId 없음 → 400', async () => {
      const res = await GET(getRequest())
      expect(res.status).toBe(400)
    })

    it('학생 → 본인 과제 목록', async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
      vi.mocked(listAssignmentsForStudent).mockResolvedValue([{ id: 'a1' }, { id: 'a2' }] as never)
      const res = await GET(getRequest())
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.items).toHaveLength(2)
      expect(listAssignmentsForStudent).toHaveBeenCalledWith(STUDENT_ID)
    })

    it('미인증(401) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await GET(getRequest())
      expect(res.status).toBe(401)
    })

    it('조회 중 예외 → 500', async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
      vi.mocked(listAssignmentsForStudent).mockRejectedValue(new Error('db down'))
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await GET(getRequest())
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('소유 수업 + 정상 입력 → 201', async () => {
      classesResult.data = { id: CLASS_ID }
      const res = await POST(postRequest({ class_id: CLASS_ID, title: '주말 일기', prompt_text: '쓰세요' }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.assignment.id).toBe('a-new')
      expect(createAssignment).toHaveBeenCalled()
    })

    it('학생 권한(403) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('professor 권한이 필요합니다', 403))
      const res = await POST(postRequest({ class_id: CLASS_ID, title: 'x', prompt_text: 'y' }))
      expect(res.status).toBe(403)
    })

    it('잘못된 JSON → 400', async () => {
      const res = await POST(postRequest('{bad'))
      expect(res.status).toBe(400)
    })

    it('유효하지 않은 class_id → 400', async () => {
      const res = await POST(postRequest({ class_id: 'not-uuid', title: 'x', prompt_text: 'y' }))
      expect(res.status).toBe(400)
    })

    it('title 누락 → 400', async () => {
      const res = await POST(postRequest({ class_id: CLASS_ID, prompt_text: 'y' }))
      expect(res.status).toBe(400)
    })

    it('잘못된 due_date → 400', async () => {
      const res = await POST(
        postRequest({ class_id: CLASS_ID, title: 'x', prompt_text: 'y', due_date: 'not-a-date' })
      )
      expect(res.status).toBe(400)
    })

    it('소유하지 않은 수업 → 403', async () => {
      classesResult.data = null // 소유 클래스 없음
      const res = await POST(postRequest({ class_id: CLASS_ID, title: 'x', prompt_text: 'y' }))
      expect(res.status).toBe(403)
    })

    it('루브릭 소유자 아님 → 403', async () => {
      classesResult.data = { id: CLASS_ID }
      rubricsResult.data = null
      const res = await POST(
        postRequest({ class_id: CLASS_ID, title: 'x', prompt_text: 'y', rubric_id: RUBRIC_ID })
      )
      expect(res.status).toBe(403)
    })

    it('createAssignment 예외 → 500', async () => {
      classesResult.data = { id: CLASS_ID }
      vi.mocked(createAssignment).mockRejectedValue(new Error('insert fail'))
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(postRequest({ class_id: CLASS_ID, title: 'x', prompt_text: 'y' }))
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })
  })
})
