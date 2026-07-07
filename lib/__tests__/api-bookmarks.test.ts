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

const bookmarksResult: { data: unknown; error: { message: string } | null } = { data: null, error: null }

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
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(getResult()).then(resolve, reject)
  })
  return b
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === 'bookmarks') return builder(() => bookmarksResult)
      throw new Error(`unexpected table: ${table}`)
    }
  })
}))

import { GET, POST } from '@/app/api/bookmarks/route'
import { requireAuth, AuthError } from '@/lib/auth'

const STUDENT_ID = 'student-1'

function getRequest(url = 'http://localhost/api/bookmarks'): Request {
  return new Request(url, { method: 'GET' })
}
function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/bookmarks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('/api/bookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bookmarksResult.data = null
    bookmarksResult.error = null
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
  })

  describe('GET', () => {
    it('북마크 목록 반환', async () => {
      bookmarksResult.data = [{ id: 'b1', student_id: STUDENT_ID, sentence: '我喜欢学习' }]
      const res = await GET(getRequest('http://localhost/api/bookmarks?limit=5'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.items).toHaveLength(1)
    })

    it('미인증(401) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await GET(getRequest())
      expect(res.status).toBe(401)
    })

    it('DB 오류 → 500', async () => {
      bookmarksResult.error = { message: 'boom' }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await GET(getRequest())
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('정상 저장 → 201', async () => {
      bookmarksResult.data = { id: 'b-new', student_id: STUDENT_ID, sentence: '我喜欢学习', note: '메모' }
      const res = await POST(postRequest({ sentence: '我喜欢学习', note: '메모', error_card_id: 'ec-1' }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.item.sentence).toBe('我喜欢学习')
    })

    it('sentence 누락 → 400', async () => {
      const res = await POST(postRequest({ note: '메모만' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/sentence/)
    })

    it('공백만 있는 sentence → 400', async () => {
      const res = await POST(postRequest({ sentence: '   ' }))
      expect(res.status).toBe(400)
    })

    it('잘못된 JSON → 400', async () => {
      const res = await POST(postRequest('{bad'))
      expect(res.status).toBe(400)
    })

    it('insert 오류 → 500', async () => {
      bookmarksResult.data = null
      bookmarksResult.error = { message: 'insert failed' }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(postRequest({ sentence: '我喜欢学习' }))
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })

    it('미인증(401) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await POST(postRequest({ sentence: '我喜欢学习' }))
      expect(res.status).toBe(401)
    })
  })
})
