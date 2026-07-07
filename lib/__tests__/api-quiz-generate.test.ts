import { describe, it, expect, vi, beforeEach } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

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

// error_cards 조회 결과를 테스트별로 구성한다.
const cardsResult: { data: unknown; error: { message: string } | null } = { data: null, error: null }

function builder(getResult: () => unknown) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  Object.assign(b, {
    select: chain,
    eq: chain,
    order: chain,
    limit: chain,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(resolve, reject)
  })
  return b
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === 'error_cards') return builder(() => cardsResult)
      throw new Error(`unexpected table: ${table}`)
    }
  })
}))

// Claude 호출은 dispatchJSON 레벨에서 모킹한다(파서 콜백은 실행되지 않는다).
vi.mock('@/lib/ai/dispatch', () => ({
  dispatchJSON: vi.fn(),
  dispatchText: vi.fn()
}))

import { POST } from '@/app/api/quiz/generate/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { dispatchJSON } from '@/lib/ai/dispatch'

const STUDENT_ID = 'student-1'

// Anthropic 에러는 프로토타입 기반으로 만들어 instanceof 분기를 정확히 태운다.
function makeAnthropicError(Ctor: { prototype: object }, status: number, message: string) {
  const e = Object.create(Ctor.prototype) as { status: number; message: string }
  e.status = status
  e.message = message
  return e
}

function postRequest(body: unknown = {}): Request {
  return new Request('http://localhost/api/quiz/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

const SAMPLE_CARD = {
  id: 'card-1',
  error_span: '很',
  error_type: 'grammar',
  error_subtype: '부사',
  correction: '非常',
  explanation: '정도 부사',
  hsk_level: 3
}

describe('POST /api/quiz/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cardsResult.data = null
    cardsResult.error = null
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
  })

  it('오류 카드 없음 → 빈 questions 배열(200)', async () => {
    cardsResult.data = []
    const res = await POST(postRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toEqual([])
    expect(dispatchJSON).not.toHaveBeenCalled()
  })

  it('정상 생성 → dispatchJSON 결과 반환', async () => {
    cardsResult.data = [SAMPLE_CARD]
    vi.mocked(dispatchJSON).mockResolvedValue({
      questions: [{ error_card_id: 'card-1', question: '___', options: ['a', 'b', 'c', 'd', 'e'], correct_index: 0, explanation: 'x' }]
    } as never)

    const res = await POST(postRequest({ count: 3 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.questions).toHaveLength(1)
    expect(dispatchJSON).toHaveBeenCalledOnce()
  })

  it('error_cards 조회 오류 → 500', async () => {
    cardsResult.error = { message: 'boom' }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postRequest())
    errSpy.mockRestore()
    expect(res.status).toBe(500)
  })

  it('Claude RateLimitError → 429', async () => {
    cardsResult.data = [SAMPLE_CARD]
    vi.mocked(dispatchJSON).mockRejectedValue(makeAnthropicError(Anthropic.RateLimitError, 429, 'rate'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postRequest())
    errSpy.mockRestore()
    expect(res.status).toBe(429)
  })

  it('Claude APIError → 해당 status 전파', async () => {
    cardsResult.data = [SAMPLE_CARD]
    vi.mocked(dispatchJSON).mockRejectedValue(makeAnthropicError(Anthropic.APIError, 400, 'bad request'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postRequest())
    errSpy.mockRestore()
    expect(res.status).toBe(400)
  })

  it('일반 예외 → 500', async () => {
    cardsResult.data = [SAMPLE_CARD]
    vi.mocked(dispatchJSON).mockRejectedValue(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(postRequest())
    errSpy.mockRestore()
    expect(res.status).toBe(500)
  })

  it('미인증(401) → status 그대로', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
    const res = await POST(postRequest())
    expect(res.status).toBe(401)
  })

  it('학생 권한 아님(403) → status 그대로', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
    const res = await POST(postRequest())
    expect(res.status).toBe(403)
  })
})
