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

const vocabResult: { data: unknown; error: { message: string } | null } = { data: null, error: null }

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
      if (table === 'vocabulary') return builder(() => vocabResult)
      throw new Error(`unexpected table: ${table}`)
    }
  })
}))

vi.mock('@/lib/gamification', () => ({
  addXp: vi.fn(),
  XP_FOR_VOCAB_ADD: 3
}))

import { GET, POST } from '@/app/api/vocab/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { addXp } from '@/lib/gamification'

const STUDENT_ID = 'student-1'

function getRequest(url = 'http://localhost/api/vocab'): Request {
  return new Request(url, { method: 'GET' })
}
function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/vocab', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

describe('/api/vocab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vocabResult.data = null
    vocabResult.error = null
    vi.mocked(requireAuth).mockResolvedValue({ userId: STUDENT_ID, role: 'student', email: null })
    vi.mocked(addXp).mockResolvedValue({ xp: 3, level: 1, leveledUp: false } as never)
  })

  describe('GET', () => {
    it('단어 목록 반환 + limit 파싱', async () => {
      vocabResult.data = [{ id: 'v1', student_id: STUDENT_ID, chinese: '你好' }]
      const res = await GET(getRequest('http://localhost/api/vocab?limit=10'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.items).toHaveLength(1)
    })

    it('limit 이상치 방어(음수/과대) 에도 정상 200', async () => {
      vocabResult.data = []
      const res = await GET(getRequest('http://localhost/api/vocab?limit=99999'))
      expect(res.status).toBe(200)
    })

    it('미인증(401) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))
      const res = await GET(getRequest())
      expect(res.status).toBe(401)
    })

    it('DB 오류 → 500', async () => {
      vocabResult.error = { message: 'boom' }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await GET(getRequest())
      errSpy.mockRestore()
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('정상 저장 → 201 + XP 부여', async () => {
      vocabResult.data = { id: 'v-new', student_id: STUDENT_ID, chinese: '谢谢' }
      const res = await POST(postRequest({ chinese: '谢谢', pinyin: 'xièxie', korean: '고맙다' }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.item.chinese).toBe('谢谢')
      expect(addXp).toHaveBeenCalledWith(STUDENT_ID, 3)
    })

    it('XP 부여 실패해도 저장은 성공(비치명적) → 201', async () => {
      vocabResult.data = { id: 'v-new', chinese: '谢谢' }
      vi.mocked(addXp).mockRejectedValue(new Error('xp down'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const res = await POST(postRequest({ chinese: '谢谢' }))
      warnSpy.mockRestore()
      expect(res.status).toBe(201)
    })

    it('chinese 누락 → 400', async () => {
      const res = await POST(postRequest({ pinyin: 'xièxie' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/chinese/)
    })

    it('잘못된 JSON → 400', async () => {
      const res = await POST(postRequest('{bad'))
      expect(res.status).toBe(400)
    })

    it('insert 오류 → 500', async () => {
      vocabResult.data = null
      vocabResult.error = { message: 'insert failed' }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(postRequest({ chinese: '谢谢' }))
      errSpy.mockRestore()
      expect(res.status).toBe(500)
      expect(addXp).not.toHaveBeenCalled()
    })

    it('학생 권한 아님(403) → status 그대로', async () => {
      vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))
      const res = await POST(postRequest({ chinese: '谢谢' }))
      expect(res.status).toBe(403)
    })
  })
})
