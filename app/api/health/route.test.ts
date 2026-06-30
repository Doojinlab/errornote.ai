import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// createServerClient 를 모킹해 next/headers(cookies) 의존과 실제 DB 호출을 끊는다.
const selectMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({ select: selectMock }),
  }),
}))

import { GET } from './route'
import { REQUIRED_SERVER_ENV } from '@/lib/env'

const ORIGINAL = { ...process.env }

beforeEach(() => {
  selectMock.mockReset()
  for (const name of REQUIRED_SERVER_ENV) process.env[name] = 'x'
})

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key]
  }
  Object.assign(process.env, ORIGINAL)
})

describe('GET /api/health', () => {
  it('env 충족 + DB 연결 → status ok, 200', async () => {
    selectMock.mockResolvedValue({ error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(body.env.ok).toBe(true)
    expect(body.env.missing).toEqual([])
    expect(typeof body.time).toBe('string')
  })

  it('DB 쿼리 에러 → degraded, 503, db=fail', async () => {
    selectMock.mockResolvedValue({ error: { message: 'boom' } })
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.db).toBe('fail')
  })

  it('DB 연결 예외(throw) → db=fail', async () => {
    selectMock.mockRejectedValue(new Error('conn refused'))
    const res = await GET()
    const body = await res.json()
    expect(body.db).toBe('fail')
    expect(body.status).toBe('degraded')
  })

  it('env 누락 → degraded, missing 엔 이름만, 시크릿 값은 응답에 없음', async () => {
    selectMock.mockResolvedValue({ error: null })
    process.env.ANTHROPIC_API_KEY = 'super-secret-value' // 설정됨(누락 아님)
    delete process.env.SUPABASE_SERVICE_ROLE_KEY // 하나 누락
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.env.missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(JSON.stringify(body)).not.toContain('super-secret-value')
  })
})
