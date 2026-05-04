// Phase 4-B — 주간 리포트 카카오 알림 발송 헬퍼.
// [창] feat/phase4-weekly-report
//
// lib/kakao.ts 의 EVENT_MESSAGES 는 기존 4개 이벤트만 다룬다.
// "lib/ 의 기존 로직은 수정하지 않는다" 제약에 따라 새 이벤트 'weekly_report' 는
// 본 모듈에서 직접 KakaoMessageTemplate 을 만들어 sendKakaoMessage 호출.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendKakaoMessage, refreshAccessToken } from '@/lib/kakao'
import { createAdminClient } from '@/lib/supabase'
import { getKakaoTokens, setKakaoTokens } from '@/lib/kakao-tokens'
import { logSecurityEvent } from '@/lib/security-log'
import type { KakaoMessageTemplate, SendKakaoResult } from '@/types/kakao'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<Database, any, any, any>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://errornote.ai'

/** 연속 실패가 이 임계 이상이면 카카오 발송을 스킵하고 인앱만 발송한다. */
export const KAKAO_FAILURE_FALLBACK_THRESHOLD = 3

export function buildWeeklyReportTemplate(input: {
  studentName: string
  headline: string
}): KakaoMessageTemplate {
  const text = `📊 ${input.studentName}님 — 이번 주 학습 제안이 도착했습니다.\n${input.headline}`
  return {
    object_type: 'text',
    text,
    link: {
      web_url: `${APP_URL}/notifications/inbox`,
      mobile_web_url: `${APP_URL}/notifications/inbox`
    },
    button_title: '제안 확인'
  }
}

/**
 * 학생에게 주간 리포트 카카오 메시지 발송.
 * - notification_settings 의 암호화된 access token 없음 → no-op
 * - 연속 실패(kakao_consecutive_failures)가 임계 이상이면 발송 스킵(인앱 폴백)
 * - 401 시 refresh_token 으로 재발급 후 재시도 (RPC kakao_set_tokens 로 재저장)
 * - 성공 → 카운터 0 리셋, 실패 → +1. 결과 반환(cron 측이 카운팅)
 */
export async function notifyWeeklyReportKakao(
  _supabase: SB,
  userId: string,
  template: KakaoMessageTemplate
): Promise<SendKakaoResult> {
  const admin = createAdminClient()
  let tokens
  try {
    tokens = await getKakaoTokens(admin, userId)
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : '토큰 조회 실패' }
  }
  if (!tokens?.access_token) {
    return { sent: false, error: '카카오 연동 안됨' }
  }

  // 연속 실패 임계 도달 → 즉시 폴백 (kakao 발송 안함, 호출 측이 인앱만 처리하도록).
  const { data: settingsRow } = await admin
    .from('notification_settings')
    .select('kakao_consecutive_failures')
    .eq('user_id', userId)
    .maybeSingle()
  const consecutive = settingsRow?.kakao_consecutive_failures ?? 0
  if (consecutive >= KAKAO_FAILURE_FALLBACK_THRESHOLD) {
    return {
      sent: false,
      error: `kakao_fallback: ${consecutive}회 연속 실패로 카카오 발송 스킵`
    }
  }

  let token = tokens.access_token
  let result = await sendKakaoMessage(token, template)

  if (!result.sent && result.error?.includes('401') && tokens.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token)
      token = refreshed.access_token
      await setKakaoTokens(admin, userId, {
        access: refreshed.access_token,
        refresh: refreshed.refresh_token ?? null,
        kakaoUserId: null,
      })
      logSecurityEvent({ tag: 'kakao_token', event: 'refresh', user_id: userId })
      result = await sendKakaoMessage(token, template)
    } catch (refreshErr) {
      result = {
        sent: false,
        error: `토큰 갱신 실패: ${
          refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
        }`
      }
    }
  }

  // 결과를 토대로 연속 실패 카운터 갱신. 성공 → 0 리셋, 실패 → +1.
  await admin
    .from('notification_settings')
    .update({ kakao_consecutive_failures: result.sent ? 0 : consecutive + 1 })
    .eq('user_id', userId)

  return result
}
