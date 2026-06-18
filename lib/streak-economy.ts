// 스트릭 경제 (Streak Economy) — gamification-spec M2 / Phase G3.
// 손실회피를 "부드럽게"만 쓴다(무벌점 원칙):
//   - 보호권: 주 1회 자동 지급(상한 2). 하루 결석은 보호권으로 자동 방어 → 죄책감 없는 복귀.
//   - 유형별 무사고 스트릭: "把자문 N일째 무사고" 처럼 실수를 *안 하는 것*을 축하.
//   - 마일스톤(7/30/100): 연출 트리거(연출 UI 는 별도).
//
// 쓰기 무결성: 보호권 지급/소비·유형별 스트릭은 SECURITY DEFINER RPC 경유
// (auth.uid() 가드). lib 은 RPC 호출 + 스트릭 일자 계산만 담당.

import { createServerClient } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// @supabase/ssr 0.5.x ↔ supabase-js 2.105 의 SupabaseClient 제네릭 arity 불일치로
// SSR 클라이언트의 .rpc()/.update() Args 추론이 깨진다(lib/supabase.ts·#67 참조).
// 호출부에서 정상 타입으로 좁힌다.
function db(): SupabaseClient<Database> {
  return createServerClient() as unknown as SupabaseClient<Database>
}

/** 보호권 보유 상한(주 1회 지급, 최대 2장 비축). */
export const MAX_STREAK_PROTECTORS = 2
/** 연출 트리거가 되는 스트릭 마일스톤(일). */
export const STREAK_MILESTONES: readonly number[] = [7, 30, 100]

// ── 날짜 헬퍼(UTC 기준, lib/gamification.ts 와 동일 규약) ──────────────────────
function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diffDays(a: string, b: string): number {
  const ad = Date.parse(a)
  const bd = Date.parse(b)
  if (Number.isNaN(ad) || Number.isNaN(bd)) return Number.POSITIVE_INFINITY
  return Math.round((bd - ad) / (1000 * 60 * 60 * 24))
}

// ── 보호권 ────────────────────────────────────────────────────────────────────

export interface ProtectorGrant {
  streakProtectors: number
  granted: boolean
}

/**
 * 주간 보호권 자동 지급. 해당 ISO 주에 아직 안 받았으면 +1(상한 2), 받았으면 no-op.
 * 학생 로그인/데일리 진입 시 호출하는 용도.
 */
export async function grantWeeklyProtector(studentId: string): Promise<ProtectorGrant> {
  const { data, error } = await db().rpc('grant_weekly_streak_protector', {
    p_student_id: studentId
  })
  if (error) {
    throw new Error(`grant_weekly_streak_protector RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{ streak_protectors: number; granted: boolean }> | null)?.[0]
  if (!row) {
    throw new Error('grant_weekly_streak_protector 결과가 비어 있습니다')
  }
  return { streakProtectors: row.streak_protectors, granted: row.granted }
}

export interface ProtectorConsumption {
  streakProtectors: number
  consumed: boolean
}

/** 보호권 1 소비(하루 결석 자동 방어). 보유 0 이면 consumed=false. */
export async function consumeStreakProtector(studentId: string): Promise<ProtectorConsumption> {
  const { data, error } = await db().rpc('consume_streak_protector', {
    p_student_id: studentId
  })
  if (error) {
    throw new Error(`consume_streak_protector RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{ streak_protectors: number; consumed: boolean }> | null)?.[0]
  if (!row) {
    throw new Error('consume_streak_protector 결과가 비어 있습니다')
  }
  return { streakProtectors: row.streak_protectors, consumed: row.consumed }
}

// ── 보호권 적용 스트릭 갱신 ───────────────────────────────────────────────────

export interface ProtectedStreakResult {
  streakDays: number
  /** 오늘 처음/연속 갱신이면 true, 오늘 이미 갱신했으면 false */
  changed: boolean
  /** 7일 달성으로 보너스 XP 대상이 된 이번 호출이면 true */
  reachedStreak7: boolean
  /** 하루 결석을 보호권으로 방어해 연속을 유지했으면 true */
  protectorUsed: boolean
  /** 최장 스트릭(이번 갱신 반영) */
  longestStreak: number
  /** 이번 갱신으로 도달한 마일스톤(7/30/100), 없으면 null */
  milestone: number | null
}

/**
 * 오늘 활동을 반영해 스트릭을 갱신하되, 하루 결석은 보호권으로 자동 방어한다.
 * updateStreak(lib/gamification.ts)의 무벌점 확장판:
 *   - 오늘 이미 갱신:                 no-op (changed=false)
 *   - 어제 활동(gap=1):               streak +1
 *   - 정확히 하루 결석(gap=2)+보호권:  보호권 1 소비, streak +1 (protectorUsed)
 *   - 그 외(2일↑ 공백 또는 보호권 없음): streak=1 리셋 (무벌점)
 */
export async function updateStreakWithProtection(studentId: string): Promise<ProtectedStreakResult> {
  const supabase = db()
  const { data, error } = await supabase
    .from('gamification_stats')
    .select('streak_days, last_active_date, streak_protectors, longest_streak')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) {
    throw new Error(`gamification_stats 조회 실패: ${error.message}`)
  }

  const row = data as {
    streak_days: number
    last_active_date: string | null
    streak_protectors: number
    longest_streak: number
  } | null

  const streakDaysPrev = row?.streak_days ?? 0
  const lastActive = row?.last_active_date ?? null
  const protectors = row?.streak_protectors ?? 0
  const longestPrev = row?.longest_streak ?? 0

  const today = toYmd(new Date())

  if (lastActive === today) {
    return {
      streakDays: streakDaysPrev,
      changed: false,
      reachedStreak7: false,
      protectorUsed: false,
      longestStreak: longestPrev,
      milestone: null
    }
  }

  let streakDays: number
  let protectorUsed = false
  if (lastActive) {
    const gap = diffDays(lastActive, today)
    if (gap === 1) {
      streakDays = streakDaysPrev + 1
    } else if (gap === 2 && protectors > 0) {
      streakDays = streakDaysPrev + 1
      protectorUsed = true
    } else {
      streakDays = 1
    }
  } else {
    streakDays = 1
  }

  // 보호권을 먼저 atomic 하게 소비(무결성). 실패 시 streak 도 쓰지 않는다.
  if (protectorUsed) {
    const res = await consumeStreakProtector(studentId)
    if (!res.consumed) {
      // 동시성으로 보호권이 사라졌다면 방어 없이 리셋으로 처리.
      streakDays = 1
      protectorUsed = false
    }
  }

  // 마일스톤/최장 기록은 최종 streakDays 기준으로 확정한다.
  const longestStreak = Math.max(longestPrev, streakDays)
  const milestone = STREAK_MILESTONES.includes(streakDays) ? streakDays : null

  const { error: upErr } = await supabase
    .from('gamification_stats')
    .upsert(
      {
        student_id: studentId,
        streak_days: streakDays,
        last_active_date: today,
        longest_streak: longestStreak,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'student_id' }
    )
  if (upErr) {
    throw new Error(`gamification_stats 스트릭 update 실패: ${upErr.message}`)
  }

  return {
    streakDays,
    changed: true,
    reachedStreak7: streakDays === 7,
    protectorUsed,
    longestStreak,
    milestone
  }
}

// ── 유형별 무사고 스트릭 ──────────────────────────────────────────────────────

export interface ErrorTypeStreakResult {
  noErrorDays: number
  bestDays: number
}

/**
 * 오류 유형(code)별 무사고 스트릭을 하루 단위로 갱신한다.
 *  - hadError=true  → 오늘 이 유형에서 오류 발생 → 0 으로 리셋
 *  - hadError=false → 오늘 처음 반영이면 +1, 최고 기록 갱신(하루 1회)
 */
export async function advanceErrorTypeStreak(
  studentId: string,
  code: string,
  hadError: boolean
): Promise<ErrorTypeStreakResult> {
  const { data, error } = await db().rpc('advance_error_type_streak', {
    p_student_id: studentId,
    p_code: code,
    p_had_error: hadError
  })
  if (error) {
    throw new Error(`advance_error_type_streak RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{ no_error_days: number; best_days: number }> | null)?.[0]
  if (!row) {
    throw new Error('advance_error_type_streak 결과가 비어 있습니다')
  }
  return { noErrorDays: row.no_error_days, bestDays: row.best_days }
}
