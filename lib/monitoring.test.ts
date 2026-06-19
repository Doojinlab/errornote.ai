import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { captureException, captureMessage, trackMetric } from './monitoring'

// Sentry 미설정 환경(테스트 기본) → 구조적 콘솔 로그 폴백 경로를 검증한다.

let errSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>
let savedDsn: string | undefined
let savedPublicDsn: string | undefined

beforeEach(() => {
  savedDsn = process.env.SENTRY_DSN
  savedPublicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  delete process.env.SENTRY_DSN
  delete process.env.NEXT_PUBLIC_SENTRY_DSN
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  if (savedDsn === undefined) delete process.env.SENTRY_DSN
  else process.env.SENTRY_DSN = savedDsn
  if (savedPublicDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN
  else process.env.NEXT_PUBLIC_SENTRY_DSN = savedPublicDsn
  vi.restoreAllMocks()
})

function lastJson(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const calls = spy.mock.calls
  return JSON.parse(calls[calls.length - 1][0] as string)
}

describe('captureException()', () => {
  it('Error → console.error 에 구조적 JSON(name:message + stack)', () => {
    captureException(new Error('boom'), { route: '/x' })
    expect(errSpy).toHaveBeenCalledOnce()
    const o = lastJson(errSpy)
    expect(o.tag).toBe('exception')
    expect(o.level).toBe('error')
    expect(o.message).toBe('Error: boom')
    expect((o.context as Record<string, unknown>).route).toBe('/x')
    expect(o.ts).toBeTypeOf('string')
  })

  it('비-Error 값도 문자열로 보고', () => {
    captureException('plain failure')
    const o = lastJson(errSpy)
    expect(o.message).toBe('plain failure')
  })
})

describe('captureMessage()', () => {
  it('warning → console.warn 에 구조적 JSON', () => {
    captureMessage('쿼터 경보', 'warning', { pct: 90 })
    const o = lastJson(warnSpy)
    expect(o.tag).toBe('message')
    expect(o.level).toBe('warning')
    expect(o.message).toBe('쿼터 경보')
    expect((o.context as Record<string, unknown>).pct).toBe(90)
  })

  it('기본 레벨 info → console.log', () => {
    captureMessage('단순 알림')
    const o = lastJson(logSpy)
    expect(o.level).toBe('info')
  })
})

describe('trackMetric()', () => {
  it('metric JSON 으로 console.log', () => {
    trackMetric('claude.cost_usd', 0.0123, { task: 'analyze' })
    const o = lastJson(logSpy)
    expect(o.tag).toBe('metric')
    expect(o.metric).toBe('claude.cost_usd')
    expect(o.value).toBe(0.0123)
    expect((o.tags as Record<string, unknown>).task).toBe('analyze')
  })
})
