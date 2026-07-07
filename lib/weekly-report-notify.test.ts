import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KakaoMessageTemplate } from '@/types/kakao'

// 외부 의존성 목 — vi.hoisted 로 factory 실행 전에 생성.
const mocks = vi.hoisted(() => ({
  sendKakaoMessage: vi.fn(),
  refreshAccessToken: vi.fn(),
  getKakaoTokens: vi.fn(),
  setKakaoTokens: vi.fn(),
  logSecurityEvent: vi.fn(),
  createAdminClient: vi.fn()
}))

vi.mock('@/lib/kakao', () => ({
  sendKakaoMessage: mocks.sendKakaoMessage,
  refreshAccessToken: mocks.refreshAccessToken
}))
vi.mock('@/lib/supabase', () => ({
  createAdminClient: mocks.createAdminClient
}))
vi.mock('@/lib/kakao-tokens', () => ({
  getKakaoTokens: mocks.getKakaoTokens,
  setKakaoTokens: mocks.setKakaoTokens
}))
vi.mock('@/lib/security-log', () => ({
  logSecurityEvent: mocks.logSecurityEvent
}))

import {
  buildWeeklyReportTemplate,
  notifyWeeklyReportKakao,
  KAKAO_FAILURE_FALLBACK_THRESHOLD
} from './weekly-report-notify'

// notification_settings 행 + update 캡처.
let settingsRow: { kakao_consecutive_failures: number } | null = { kakao_consecutive_failures: 0 }
const updateSpy = vi.fn()

function adminBuilder() {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.update = vi.fn((patch: unknown) => {
    updateSpy(patch)
    return b
  })
  b.maybeSingle = vi.fn(() => Promise.resolve({ data: settingsRow, error: null }))
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(res, rej)
  return b
}
const mockAdmin = { from: vi.fn(() => adminBuilder()) }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anySupabase = {} as any
const template: KakaoMessageTemplate = {
  object_type: 'text',
  text: 'hi',
  link: { web_url: 'https://x', mobile_web_url: 'https://x' }
}

beforeEach(() => {
  vi.clearAllMocks()
  settingsRow = { kakao_consecutive_failures: 0 }
  mocks.createAdminClient.mockReturnValue(mockAdmin)
  mocks.getKakaoTokens.mockResolvedValue({
    access_token: 'tok',
    refresh_token: 'ref',
    kakao_user_id: null,
    enabled_events: {}
  })
})

describe('buildWeeklyReportTemplate()', () => {
  it('학생 이름과 헤드라인을 담은 카카오 text 템플릿 생성', () => {
    const t = buildWeeklyReportTemplate({ studentName: '김민수', headline: '이번 주 학습 제안' })
    expect(t.object_type).toBe('text')
    expect(t.text).toContain('김민수')
    expect(t.text).toContain('이번 주 학습 제안')
    expect(t.link.web_url).toMatch(/\/notifications\/inbox$/)
    expect(t.button_title).toBe('제안 확인')
  })
})

describe('KAKAO_FAILURE_FALLBACK_THRESHOLD', () => {
  it('임계값은 3', () => {
    expect(KAKAO_FAILURE_FALLBACK_THRESHOLD).toBe(3)
  })
})

describe('notifyWeeklyReportKakao()', () => {
  it('토큰 조회 실패 → sent:false + 에러 메시지', async () => {
    mocks.getKakaoTokens.mockRejectedValueOnce(new Error('boom'))
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res).toEqual({ sent: false, error: 'boom' })
    expect(mocks.sendKakaoMessage).not.toHaveBeenCalled()
  })

  it('토큰 없음 → 카카오 연동 안됨', async () => {
    mocks.getKakaoTokens.mockResolvedValueOnce(null)
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res).toEqual({ sent: false, error: '카카오 연동 안됨' })
    expect(mocks.sendKakaoMessage).not.toHaveBeenCalled()
  })

  it('access_token 없음 → 카카오 연동 안됨', async () => {
    mocks.getKakaoTokens.mockResolvedValueOnce({
      access_token: null,
      refresh_token: null,
      kakao_user_id: null,
      enabled_events: {}
    })
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.error).toBe('카카오 연동 안됨')
  })

  it('연속 실패 임계 도달 → 발송 스킵(인앱 폴백)', async () => {
    settingsRow = { kakao_consecutive_failures: 3 }
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.sent).toBe(false)
    expect(res.error).toMatch(/kakao_fallback/)
    expect(mocks.sendKakaoMessage).not.toHaveBeenCalled()
  })

  it('발송 성공 → 연속 실패 카운터 0 리셋', async () => {
    mocks.sendKakaoMessage.mockResolvedValueOnce({ sent: true, result_code: 0 })
    settingsRow = { kakao_consecutive_failures: 2 }
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.sent).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith({ kakao_consecutive_failures: 0 })
  })

  it('발송 실패(비401) → 카운터 +1, 갱신 시도 없음', async () => {
    mocks.sendKakaoMessage.mockResolvedValueOnce({ sent: false, error: '500 server error' })
    settingsRow = { kakao_consecutive_failures: 1 }
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.sent).toBe(false)
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalledWith({ kakao_consecutive_failures: 2 })
  })

  it('401 + refresh_token → 토큰 갱신 후 재발송 성공', async () => {
    mocks.sendKakaoMessage
      .mockResolvedValueOnce({ sent: false, error: '401 unauthorized' })
      .mockResolvedValueOnce({ sent: true, result_code: 0 })
    mocks.refreshAccessToken.mockResolvedValueOnce({
      access_token: 'newtok',
      refresh_token: 'newref'
    })
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.sent).toBe(true)
    expect(mocks.setKakaoTokens).toHaveBeenCalled()
    expect(mocks.logSecurityEvent).toHaveBeenCalled()
    expect(mocks.sendKakaoMessage).toHaveBeenCalledTimes(2)
    expect(mocks.sendKakaoMessage).toHaveBeenLastCalledWith('newtok', template)
    expect(updateSpy).toHaveBeenCalledWith({ kakao_consecutive_failures: 0 })
  })

  it('401 + refresh_token 이지만 갱신 실패 → 실패 결과 + 카운터 +1', async () => {
    mocks.sendKakaoMessage.mockResolvedValueOnce({ sent: false, error: '401 unauthorized' })
    mocks.refreshAccessToken.mockRejectedValueOnce(new Error('refresh boom'))
    settingsRow = { kakao_consecutive_failures: 0 }
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.sent).toBe(false)
    expect(res.error).toMatch(/토큰 갱신 실패.*refresh boom/)
    expect(updateSpy).toHaveBeenCalledWith({ kakao_consecutive_failures: 1 })
  })

  it('401 이지만 refresh_token 없음 → 갱신 시도 없이 실패', async () => {
    mocks.getKakaoTokens.mockResolvedValueOnce({
      access_token: 'tok',
      refresh_token: null,
      kakao_user_id: null,
      enabled_events: {}
    })
    mocks.sendKakaoMessage.mockResolvedValueOnce({ sent: false, error: '401 unauthorized' })
    const res = await notifyWeeklyReportKakao(anySupabase, 'u1', template)
    expect(res.sent).toBe(false)
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled()
    expect(updateSpy).toHaveBeenCalledWith({ kakao_consecutive_failures: 1 })
  })
})
