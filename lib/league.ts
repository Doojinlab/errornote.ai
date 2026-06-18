// 익명 주간 리그 (Anonymous Weekly League) — gamification-spec M8 / Phase G4.
// 보조 메커닉: 익명 닉네임 주간 리그(브론즈→실버→골드).
// 실명 동기 간 "누가 더 틀렸나" 경쟁은 금지 → 순위는 익명(anon_seed)으로만 노출.

import { createServerClient } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { anonNickname } from './anon'

function db(): SupabaseClient<Database> {
  return createServerClient() as unknown as SupabaseClient<Database>
}

export type LeagueTier = 'bronze' | 'silver' | 'gold'

/** 티어 승급 임계치(주간 포인트). */
export const LEAGUE_SILVER_AT = 100
export const LEAGUE_GOLD_AT = 300

export function leagueTier(points: number): LeagueTier {
  if (points >= LEAGUE_GOLD_AT) return 'gold'
  if (points >= LEAGUE_SILVER_AT) return 'silver'
  return 'bronze'
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 주어진 날짜가 속한 주의 시작일(월요일, UTC). Postgres date_trunc('week') 와 일치. */
export function weekStartOf(d: Date): string {
  const dow = d.getUTCDay() // 0=일 .. 6=토
  const toMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + toMonday))
  return toYmd(monday)
}

/** 이번 주(또는 지정 주) 리그 포인트 적립. 누적 후 잔액 반환. */
export async function addLeaguePoints(
  studentId: string,
  classId: string,
  points: number,
  weekStart: string = weekStartOf(new Date())
): Promise<number> {
  const { data, error } = await db().rpc('add_league_points', {
    p_student_id: studentId,
    p_class_id: classId,
    p_week_start: weekStart,
    p_points: points
  })
  if (error) {
    throw new Error(`add_league_points RPC 실패: ${error.message}`)
  }
  return (data as unknown as number) ?? 0
}

export interface LeagueStanding {
  rank: number
  points: number
  tier: LeagueTier
  nickname: string
  isMe: boolean
}

/** 반·주차 익명 순위표. anon_seed → 닉네임 매핑, 본인(isMe) 강조용 플래그 포함. */
export async function getLeagueStandings(
  classId: string,
  weekStart: string = weekStartOf(new Date())
): Promise<LeagueStanding[]> {
  const { data, error } = await db().rpc('get_league_standings', {
    p_class_id: classId,
    p_week_start: weekStart
  })
  if (error) {
    throw new Error(`get_league_standings RPC 실패: ${error.message}`)
  }
  const rows = (data as unknown as Array<{ rank: number; points: number; anon_seed: string; is_me: boolean }> | null) ?? []
  return rows.map((r) => ({
    rank: r.rank,
    points: r.points,
    tier: leagueTier(r.points),
    nickname: anonNickname(r.anon_seed),
    isMe: r.is_me
  }))
}
