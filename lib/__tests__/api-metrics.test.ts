import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/monitoring', () => ({ trackMetric: vi.fn() }))

import { POST } from '@/app/api/metrics/route'
import { trackMetric } from '@/lib/monitoring'

function postReq(body: unknown, raw = false): Request {
  return new Request('http://localhost/api/metrics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

describe('POST /api/metrics', () => {
  beforeEach(() => vi.mocked(trackMetric).mockClear())

  it('records an allowed metric and returns ok', async () => {
    const res = await POST(postReq({ name: 'pwa_install_accepted', tags: { source: 'prompt' } }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(trackMetric).toHaveBeenCalledWith('pwa_install_accepted', 1, { source: 'prompt' })
  })

  it('defaults value to 1 when missing/invalid', async () => {
    await POST(postReq({ name: 'pwa_push_enabled', value: 'NaN' }))
    expect(trackMetric).toHaveBeenCalledWith('pwa_push_enabled', 1, undefined)
  })

  it('rejects metrics not on the whitelist', async () => {
    const res = await POST(postReq({ name: 'pwa_arbitrary' }))
    expect(res.status).toBe(400)
    expect(trackMetric).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const res = await POST(postReq('{not json', true))
    expect(res.status).toBe(400)
    expect(trackMetric).not.toHaveBeenCalled()
  })
})
