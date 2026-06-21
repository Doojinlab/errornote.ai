import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logSecurityEvent } from './security-log'

describe('logSecurityEvent', () => {
  const orig = process.env.ANTHROPIC_LOG_USAGE
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    spy.mockRestore()
    if (orig === undefined) delete process.env.ANTHROPIC_LOG_USAGE
    else process.env.ANTHROPIC_LOG_USAGE = orig
  })

  it('is a no-op when ANTHROPIC_LOG_USAGE is not "1"', () => {
    process.env.ANTHROPIC_LOG_USAGE = '0'
    logSecurityEvent({ tag: 'kakao_token', event: 'connect', user_id: 'u1' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('emits a JSON line with the record + timestamp when enabled', () => {
    process.env.ANTHROPIC_LOG_USAGE = '1'
    logSecurityEvent({ tag: 'lms_api_key', event: 'rotate', key_id: 'k1' })
    expect(spy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(spy.mock.calls[0][0] as string)
    expect(payload).toMatchObject({ tag: 'lms_api_key', event: 'rotate', key_id: 'k1' })
    expect(typeof payload.ts).toBe('string')
    expect(Number.isNaN(Date.parse(payload.ts))).toBe(false)
  })
})
