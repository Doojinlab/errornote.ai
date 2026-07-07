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

// learning_goals 테이블 조회/삽입 결과를 테스트별로 구성한다.
const goalsResult: { data: unknown; error: { message: string } | null } = { data: null, error: null }

// GET 은 select().eq().order().order().order() 체인을 await 하고,
// POST 는 insert().select().single() 을 await 하므로 둘 다 지원하는 빌더를 만든다.
function builder(getResult: () => unknown) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain,
    eq: chain,
    order: chain,
    limit: chain,
    insert: chain,
    single: () => Promise.resolve(getResult()),
    maybeSingle: () => Promise.resolve(getResult()),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(resolve, reject)
  })
  return b
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === 'learning_goals') return builder(() => goalsResult)
      throw new Error(`unexpected table: ${table}`)
    }
  })
}))

vi.mock('@/lib/goals', () => ({
  calcProgressForGoals: vi.fn(),
  isValidGoalInput: vi.fn()
}))

import { GET, POST } from '@/app/api/goals/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { calcProgressForGoals, isValidGoalInput } from '@/lib/goals'

const STUDENT_ID = 'student-1'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('/api/goals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    goalsResult.data = null
    goalsResult.error = null
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
    vi.mocked(calcProgressForGoals).mockResolvedValue([])
    vi.mocked(isValidGoalInput).mockReturnValue({ ok: true })
  })

  describe('GET', () => {
    it('학생 목표 목록 + 진행도 반환', async () => {
      goalsResult.data = [
        { id: 'g1', student_id: STUDENT_ID, goal_type: 'error_count', target_value: '5' }
      ]
      vi.mocked(calcProgressForGoals).mockResolvedValue([{ goalId: 'g1', percent: 40 }] as never)

      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.goals).toHaveLength(1)
      expect(body.progress).toHaveLength(1)
      expect(requireAuth).toHaveBeenCalledWith('student')
    })

    it('미인증(401) → status 그대로 노출', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it('교수 권한(403) → status 그대로 노출', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
      const res = await GET()
      expect(res.status).toBe(403)
    })

    it('DB 조회 오류 → 500', async () => {
      goalsResult.error = { message: 'boom' }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await GET()
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('정상 생성 → 201 + goal/progress', async () => {
      goalsResult.data = { id: 'g-new', student_id: STUDENT_ID, goal_type: 'vocab_count', target_value: '10' }
      vi.mocked(calcProgressForGoals).mockResolvedValue([{ goalId: 'g-new', percent: 0 }] as never)

      const res = await POST(makeRequest({ goal_type: 'vocab_count', target_value: '10' }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.goal.id).toBe('g-new')
      expect(body.progress.goalId).toBe('g-new')
    })

    it('잘못된 JSON → 400', async () => {
      const res = await POST(makeRequest('{not json'))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/JSON/)
    })

    it('goal_type 누락 → 400', async () => {
      const res = await POST(makeRequest({ target_value: '10' }))
      expect(res.status).toBe(400)
    })

    it('유효하지 않은 goal_type → 400', async () => {
      const res = await POST(makeRequest({ goal_type: 'nonsense', target_value: '10' }))
      expect(res.status).toBe(400)
    })

    it('isValidGoalInput 실패 → 400 + reason', async () => {
      vi.mocked(isValidGoalInput).mockReturnValue({ ok: false, reason: 'target_value 는 0 이상 정수여야 합니다' })
      const res = await POST(makeRequest({ goal_type: 'error_count', target_value: '-1' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/0 이상/)
    })

    it('insert 오류 → 500', async () => {
      goalsResult.data = null
      goalsResult.error = { message: 'insert failed' }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(makeRequest({ goal_type: 'error_count', target_value: '5' }))
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })

    it('미인증(401) → status 그대로 노출', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await POST(makeRequest({ goal_type: 'error_count', target_value: '5' }))
      expect(res.status).toBe(401)
    })
  })
})
