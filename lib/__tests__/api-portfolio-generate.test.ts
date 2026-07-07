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

vi.mock('@/lib/portfolio', () => ({
  assemblePortfolio: vi.fn()
}))

import { POST } from '@/app/api/portfolio/generate/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { assemblePortfolio } from '@/lib/portfolio'

const STUDENT_ID = 'student-1'

describe('POST /api/portfolio/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
  })

  it('정상 → 포트폴리오 데이터 반환, student 권한/본인 id 로 호출', async () => {
    vi.mocked(assemblePortfolio).mockResolvedValue({
      summary: { totalSessions: 3 },
      highlights: []
    } as never)

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.totalSessions).toBe(3)
    expect(requireAuth).toHaveBeenCalledWith('student')
    expect(assemblePortfolio).toHaveBeenCalledWith(STUDENT_ID)
  })

  it('학생 권한 아님(403) → status 그대로, assemblePortfolio 미호출', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
    const res = await POST()
    expect(res.status).toBe(403)
    expect(assemblePortfolio).not.toHaveBeenCalled()
  })

  it('미인증(401) → status 그대로', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('assemblePortfolio 예외 → 500', async () => {
    vi.mocked(assemblePortfolio).mockRejectedValue(new Error('assemble fail'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST()
    errSpy.mockRestore()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
