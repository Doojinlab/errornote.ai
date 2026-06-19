import { describe, it, expect, vi } from 'vitest'
import {
  AGS_SCOPE,
  parseAgsEndpoint,
  canPostScore,
  buildScore,
  scoresUrl,
  requestAccessToken,
  sendScore,
} from './lti-ags'

describe('parseAgsEndpoint', () => {
  it('scope/lineitem/lineitems 파싱', () => {
    const ep = parseAgsEndpoint({
      scope: [AGS_SCOPE.SCORE, AGS_SCOPE.LINEITEM],
      lineitem: 'https://lms.test/li/1',
      lineitems: 'https://lms.test/li',
    })
    expect(ep).toEqual({
      scopes: [AGS_SCOPE.SCORE, AGS_SCOPE.LINEITEM],
      lineitem: 'https://lms.test/li/1',
      lineitems: 'https://lms.test/li',
    })
  })
  it('lineitem/lineitems 둘 다 없으면 null', () => {
    expect(parseAgsEndpoint({ scope: [AGS_SCOPE.SCORE] })).toBeNull()
    expect(parseAgsEndpoint(null)).toBeNull()
    expect(parseAgsEndpoint('x')).toBeNull()
  })
  it('비문자 scope 항목은 제거', () => {
    const ep = parseAgsEndpoint({ scope: [AGS_SCOPE.SCORE, 123], lineitem: 'https://lms.test/li/1' })
    expect(ep?.scopes).toEqual([AGS_SCOPE.SCORE])
  })
})

describe('canPostScore', () => {
  it('score scope + lineitem 있으면 true', () => {
    expect(canPostScore({ scopes: [AGS_SCOPE.SCORE], lineitem: 'x', lineitems: null })).toBe(true)
  })
  it('score scope 없거나 lineitem 없으면 false', () => {
    expect(canPostScore({ scopes: [AGS_SCOPE.LINEITEM], lineitem: 'x', lineitems: null })).toBe(false)
    expect(canPostScore({ scopes: [AGS_SCOPE.SCORE], lineitem: null, lineitems: 'x' })).toBe(false)
  })
})

describe('buildScore', () => {
  const base = { userId: 'u1', scoreMaximum: 100, timestamp: '2026-06-19T00:00:00Z' }
  it('기본 진행상태 + comment 포함', () => {
    const s = buildScore({ ...base, scoreGiven: 83, comment: '잘했어요' })
    expect(s).toMatchObject({
      userId: 'u1',
      scoreGiven: 83,
      scoreMaximum: 100,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      comment: '잘했어요',
    })
  })
  it('scoreGiven 을 [0, max] 로 클램프', () => {
    expect(buildScore({ ...base, scoreGiven: 150 }).scoreGiven).toBe(100)
    expect(buildScore({ ...base, scoreGiven: -10 }).scoreGiven).toBe(0)
  })
  it('scoreMaximum <= 0 이면 throw', () => {
    expect(() => buildScore({ ...base, scoreMaximum: 0, scoreGiven: 1 })).toThrow(/scoreMaximum/)
  })
})

describe('scoresUrl', () => {
  it('/scores 추가', () => {
    expect(scoresUrl('https://lms.test/li/1')).toBe('https://lms.test/li/1/scores')
  })
  it('쿼리스트링 보존', () => {
    expect(scoresUrl('https://lms.test/li/1?type_id=4')).toBe('https://lms.test/li/1/scores?type_id=4')
  })
  it('트레일링 슬래시 정규화', () => {
    expect(scoresUrl('https://lms.test/li/1/')).toBe('https://lms.test/li/1/scores')
  })
})

describe('requestAccessToken', () => {
  it('client_credentials 폼으로 토큰 요청 후 access_token 반환', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: 'tok-123' }), { status: 200 })
    ) as unknown as typeof fetch
    const token = await requestAccessToken({
      tokenUrl: 'https://lms.test/token',
      clientAssertion: 'JWT',
      scopes: [AGS_SCOPE.SCORE],
      fetchFn,
    })
    expect(token).toBe('tok-123')
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://lms.test/token')
    const body = String(call[1].body)
    expect(body).toContain('grant_type=client_credentials')
    expect(body).toContain('client_assertion=JWT')
    expect(body).toContain('jwt-bearer')
  })
  it('비정상 응답이면 throw', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 401 })) as unknown as typeof fetch
    await expect(
      requestAccessToken({ tokenUrl: 'https://lms.test/token', clientAssertion: 'J', scopes: [], fetchFn })
    ).rejects.toThrow(/토큰 요청 실패/)
  })
  it('access_token 누락이면 throw', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    await expect(
      requestAccessToken({ tokenUrl: 'https://lms.test/token', clientAssertion: 'J', scopes: [], fetchFn })
    ).rejects.toThrow(/access_token/)
  })
})

describe('sendScore', () => {
  it('scores URL 로 올바른 헤더/바디 POST', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch
    const score = buildScore({ userId: 'u1', scoreGiven: 50, scoreMaximum: 100, timestamp: 'T' })
    const res = await sendScore({
      lineitem: 'https://lms.test/li/9',
      score,
      accessToken: 'tok-123',
      fetchFn,
    })
    expect(res).toEqual({ ok: true, status: 200 })
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://lms.test/li/9/scores')
    expect(call[1].headers['Content-Type']).toBe('application/vnd.ims.lis.v1.score+json')
    expect(call[1].headers.Authorization).toBe('Bearer tok-123')
    expect(JSON.parse(call[1].body)).toMatchObject({ userId: 'u1', scoreGiven: 50 })
  })
})
