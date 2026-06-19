// Phase 4-B — 인앱 알림 (in_app_notifications) 발송/조회 헬퍼.
// [창] feat/phase4-weekly-report
//
// service-role(admin) 클라이언트에서 insert 한다. RLS 는 user 본인 select 만 허용.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { InAppNotification } from '@/types/weekly-reports'

// @supabase/ssr@0.5 가 돌려주는 클라이언트는 구 SupabaseClient 제네릭 시그니처라
// supabase-js@2.105 의 신 시그니처(`SupabaseClient<Database>`)와 직접 대입이 안 된다.
// 런타임 동작은 동일하므로 스키마 제네릭을 느슨히 받아 호출처 타입을 흡수한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RlsClient = SupabaseClient<Database, any, any, any>

export interface CreateInAppNotificationInput {
  userId: string
  type: string
  title: string
  body?: string
  linkUrl?: string | null
  payload?: Record<string, unknown>
}

// ── 무벌점(no-shame) 문구 (gamification-spec §0.2, §1.1) ──────────────────────
// 결석·저조한 활동을 탓하지 않는다. 误 동반자는 "돌아와서 반가워" 톤으로 맞이한다.

export interface WeeklyReportNotificationInput {
  /** 지난 주 작성 세션 수. 0 이면 복귀 환영(무벌점) 톤으로 분기. */
  totalSessions: number
  /** AI 생성 한 줄 요약. 있으면 body 로 사용. */
  headline?: string
}

/**
 * 주간 리포트 인앱 알림 문구를 무벌점 톤으로 만든다.
 * - 활동이 있었으면: 진척을 가볍게 축하하고 제안을 안내.
 * - 활동이 없었으면: 죄책감을 주지 않고 복귀를 환영(no-shame).
 *
 * NOTE: 현재 cron 알림은 한국어 단일 문구다(기존 동작 유지). 수신자 로케일(profiles.language)
 * 기반 ko/en/ja 분기는 별도 후속으로 분리한다.
 */
export function buildWeeklyReportNotificationCopy(
  input: WeeklyReportNotificationInput
): { title: string; body: string } {
  const headline = input.headline?.trim()
  if (input.totalSessions > 0) {
    return {
      title: '이번 주 학습 제안이 도착했어요 ✨',
      body: headline || '误 동반자가 이번 주 너의 기록을 함께 살펴봤어요.'
    }
  }
  return {
    title: '돌아오면 언제든 반가워요 🌱',
    body: headline || '한 문장만 써봐도 충분해요. 误 동반자가 기다리고 있을게요.'
  }
}

export async function createInAppNotification(
  supabase: Admin,
  input: CreateInAppNotificationInput
): Promise<string> {
  const { data, error } = await supabase
    .from('in_app_notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      link_url: input.linkUrl ?? null,
      payload: (input.payload ?? {}) as unknown as Json
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`in_app_notifications 생성 실패: ${error?.message ?? 'no row'}`)
  }
  return (data as { id: string }).id
}

/** RLS 적용 클라이언트(=auth.uid 기반)에서 본인 알림 조회. */
export async function listInAppNotifications(
  supabase: RlsClient,
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {}
): Promise<InAppNotification[]> {
  let q = supabase
    .from('in_app_notifications')
    .select('id, user_id, type, title, body, link_url, payload, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (opts.unreadOnly) q = q.is('read_at', null)
  const { data, error } = await q
  if (error) throw new Error(`in_app_notifications 조회 실패: ${error.message}`)
  return ((data ?? []) as Array<{
    id: string
    user_id: string
    type: string
    title: string
    body: string
    link_url: string | null
    payload: Json
    read_at: string | null
    created_at: string
  }>).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    link_url: r.link_url,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    read_at: r.read_at,
    created_at: r.created_at
  }))
}

/** 본인 알림 읽음 처리. RLS 적용 클라이언트에서 호출. */
export async function markNotificationRead(
  supabase: RlsClient,
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw new Error(`알림 읽음 처리 실패: ${error.message}`)
}
