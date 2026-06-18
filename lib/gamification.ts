import { createServerClient, createAdminClient } from './supabase'
import { notifyKakaoEvent } from './kakao'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { GamificationSnapshot } from '@/types'

// XP 획득 기준 (errornote.md) — 한 곳에서 관리
export const XP_FOR_DRAFT = 10
export const XP_FOR_REVISION = 20
export const XP_FOR_ZERO_ERROR_REVISION = 50
export const XP_FOR_CORRECT_QUIZ = 5
export const XP_FOR_VOCAB_ADD = 3
export const XP_FOR_STREAK_7 = 100

/** level → 필요 누적 XP */
export const LEVEL_THRESHOLDS: ReadonlyArray<number> = [0, 500, 2000, 5000]

export function calculateLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
  }
  return level
}

export function nextLevelXp(level: number): number | null {
  const idx = level // level 1 → 다음 임계 index 1
  return idx < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[idx] : null
}

interface Stats {
  level: number
  xp: number
  streak_days: number
  last_active_date: string | null
  activity_coins: number
  mastery_points: number
}

async function fetchOrInitStats(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string
): Promise<Stats> {
  const { data, error } = await supabase
    .from('gamification_stats')
    .select('level, xp, streak_days, last_active_date, activity_coins, mastery_points')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    throw new Error(`gamification_stats 조회 실패: ${error.message}`)
  }
  if (data) {
    // activity_coins/mastery_points 는 NOT NULL default 0 이지만 구 스냅샷/모킹 방어.
    const row = data as Partial<Stats> & Pick<Stats, 'level' | 'xp' | 'streak_days'>
    return {
      level: row.level,
      xp: row.xp,
      streak_days: row.streak_days,
      last_active_date: row.last_active_date ?? null,
      activity_coins: row.activity_coins ?? 0,
      mastery_points: row.mastery_points ?? 0
    }
  }

  // 최초 생성
  // TODO(deps): ssr/supabase-js 타입 경로 미스매치 해소 후 as never 제거.
  const { error: insertErr } = await supabase.from('gamification_stats').insert({
    student_id: studentId,
    level: 1,
    xp: 0,
    streak_days: 0
  } as never)
  if (insertErr) {
    throw new Error(`gamification_stats 초기화 실패: ${insertErr.message}`)
  }
  return { level: 1, xp: 0, streak_days: 0, last_active_date: null, activity_coins: 0, mastery_points: 0 }
}

export interface AddXpResult {
  level: number
  xp: number
  levelUp: boolean
}

/** studentId 에게 amount 만큼 XP 를 부여하고 레벨을 재계산한다. 레벨업 여부도 반환. */
export async function addXp(studentId: string, amount: number): Promise<AddXpResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`addXp amount 가 유효하지 않습니다: ${amount}`)
  }
  const supabase = createServerClient()
  const current = await fetchOrInitStats(supabase, studentId)

  const newXp = current.xp + Math.floor(amount)
  const newLevel = calculateLevel(newXp)
  const levelUp = newLevel > current.level

  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { error } = await supabase
    .from('gamification_stats')
    .update({
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString()
    } as never)
    .eq('student_id', studentId)

  if (error) {
    throw new Error(`gamification_stats update 실패: ${error.message}`)
  }

  if (levelUp) {
    const admin = createAdminClient()
    notifyKakaoEvent(admin, studentId, 'badge_earned', `레벨 ${newLevel}`).catch(() => {})
  }

  return { level: newLevel, xp: newXp, levelUp }
}

export interface UpdateStreakResult {
  streakDays: number
  /** 오늘 이미 갱신한 상태면 changed=false 로, 처음 또는 연속 갱신이면 true */
  changed: boolean
  /** 7일 연속 달성해 보너스 XP 지급 대상이 된 이번 호출이면 true */
  reachedStreak7: boolean
}

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

/**
 * 오늘 자 활동을 반영해 스트릭을 갱신한다.
 * - 오늘(YYYY-MM-DD) 이 last_active_date 와 같으면: no-op
 * - 어제면: streak_days + 1
 * - 그 외(오늘 처음 또는 2일 이상 공백): streak_days = 1
 */
export async function updateStreak(studentId: string): Promise<UpdateStreakResult> {
  const supabase = createServerClient()
  const stats = await fetchOrInitStats(supabase, studentId)

  const today = toYmd(new Date())
  if (stats.last_active_date === today) {
    return { streakDays: stats.streak_days, changed: false, reachedStreak7: false }
  }

  let newStreak: number
  if (stats.last_active_date && diffDays(stats.last_active_date, today) === 1) {
    newStreak = stats.streak_days + 1
  } else {
    newStreak = 1
  }

  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { error } = await supabase
    .from('gamification_stats')
    .update({
      streak_days: newStreak,
      last_active_date: today,
      updated_at: new Date().toISOString()
    } as never)
    .eq('student_id', studentId)

  if (error) {
    throw new Error(`gamification_stats 스트릭 update 실패: ${error.message}`)
  }

  return {
    streakDays: newStreak,
    changed: true,
    reachedStreak7: newStreak === 7
  }
}

export async function getSnapshot(studentId: string): Promise<GamificationSnapshot> {
  const supabase = createServerClient()
  const stats = await fetchOrInitStats(supabase, studentId)
  return {
    level: stats.level,
    xp: stats.xp,
    streak_days: stats.streak_days,
    last_active_date: stats.last_active_date,
    next_level_xp: nextLevelXp(stats.level),
    activity_coins: stats.activity_coins,
    mastery_points: stats.mastery_points
  }
}

// ── 이중 화폐 (gamification-spec M4) ──────────────────────────────────────────
// activity_coins : 활동 화폐(가챠·코스메틱). 본인이 적립/소비 가능.
// mastery_points : 숙련 화폐(오류 유형 졸업으로만 상승). 서버(service-role)에서만 적립.

export interface CurrencyState {
  activityCoins: number
  masteryPoints: number
}

async function callAwardCurrency(
  supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createAdminClient>,
  studentId: string,
  activityDelta: number,
  masteryDelta: number
): Promise<CurrencyState> {
  // server/admin 두 클라이언트의 유니온에서 .rpc 호출 시 시그니처가 합쳐지지 않는다
  // (@supabase/ssr 0.5.x 와 supabase-js 2.105 의 SupabaseClient 제네릭 arity 불일치).
  // 정상 타입으로 좁혀 호출한다. (근본 해결: @supabase/ssr 업그레이드 — #53 참조)
  const db = supabase as unknown as SupabaseClient<Database>
  const { data, error } = await db.rpc('award_currency', {
    p_student_id: studentId,
    p_activity_delta: activityDelta,
    p_mastery_delta: masteryDelta
  })
  if (error) {
    throw new Error(`award_currency RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{ activity_coins: number; mastery_points: number }> | null)?.[0]
  if (!row) {
    throw new Error('award_currency 결과가 비어 있습니다')
  }
  return { activityCoins: row.activity_coins, masteryPoints: row.mastery_points }
}

/** 활동 화폐 적립. amount 는 양수. (현재 잔액 반환) */
export async function awardActivityCoins(studentId: string, amount: number): Promise<CurrencyState> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`awardActivityCoins amount 가 유효하지 않습니다: ${amount}`)
  }
  return callAwardCurrency(createServerClient(), studentId, Math.floor(amount), 0)
}

/**
 * 활동 화폐 소비. amount 는 양수. 잔액보다 큰 소비는 DB 에서 0 으로 바닥 처리된다
 * (overdraft 없음). 잔액 검증이 필요한 가챠/구매 흐름은 호출 전에 별도 확인할 것.
 */
export async function spendActivityCoins(studentId: string, amount: number): Promise<CurrencyState> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`spendActivityCoins amount 가 유효하지 않습니다: ${amount}`)
  }
  return callAwardCurrency(createServerClient(), studentId, -Math.floor(amount), 0)
}

/**
 * 숙련 화폐 적립. 졸업(fossilization 해소) 등 서버 흐름에서만 호출한다.
 * service-role 클라이언트로 호출해야 guard_mastery_points 트리거를 통과한다.
 */
export async function awardMasteryPoints(studentId: string, amount: number): Promise<CurrencyState> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`awardMasteryPoints amount 가 유효하지 않습니다: ${amount}`)
  }
  return callAwardCurrency(createAdminClient(), studentId, 0, Math.floor(amount))
}
