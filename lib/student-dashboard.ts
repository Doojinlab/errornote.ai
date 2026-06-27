// 학생 탭(오류·성장) 실데이터 로더 + 순수 매핑 헬퍼.
// 리디자인 화면(스펙 §5)의 더미 데이터를 실제 Supabase 데이터로 교체한다.
// - 순수 함수(buildBadgeGrid/mapErrorCard/accuracyPct/formatMonthDay)는 단위 테스트 대상.
// - 로더(loadGrowthData/loadErrorsData)는 서버 컴포넌트에서만 호출(인증 세션 필요).
//   부수효과를 피하기 위해 gamification_stats 는 select 만 한다(레이아웃 loadStats 와 동일 패턴).

import { createServerClient } from './supabase'
import { getAuthContext } from './auth'
import { nextLevelXp } from './gamification'
import { getLeagueStandings } from './league'

// ── 배지 카탈로그 ────────────────────────────────────────────────────────────
// id 는 badges.badge_type 와 일치(supabase/seed.sql §4 의 6종 canonical).
// 아이콘은 리디자인 시안(이모지) 유지. earned 여부는 badges 테이블로 판정.
export interface BadgeCatalogEntry {
  id: string
  name: string
  icon: string
}

export const BADGE_CATALOG: ReadonlyArray<BadgeCatalogEntry> = [
  { id: 'zero_error', name: '완벽 교정', icon: '⭐' },
  { id: 'streak_7', name: '연속 학습 7일', icon: '🔥' },
  { id: 'vocab_100', name: '단어장 100', icon: '📚' },
  { id: 'ba_master', name: '把자문 마스터', icon: '🥋' },
  { id: 'explorer', name: '탐구자', icon: '🔍' },
  { id: 'quiz_king', name: '퀴즈왕', icon: '🎯' },
]

export interface BadgeItemData {
  id: string
  name: string
  icon: string
  earned: boolean
}

/** 획득한 badge_type 목록으로 카탈로그 전체의 earned 플래그를 채운다. */
export function buildBadgeGrid(earnedTypes: string[]): BadgeItemData[] {
  const earned = new Set(earnedTypes)
  return BADGE_CATALOG.map((b) => ({ ...b, earned: earned.has(b.id) }))
}

// ── 오류 카드 매핑 ───────────────────────────────────────────────────────────
export interface ErrorCardRow {
  id: string
  error_span: string
  error_type: 'vocab' | 'grammar'
  error_subtype: string | null
  correction: string | null
  explanation: string | null
  chapter_number: number
  created_at: string
}

export interface ErrorItemData {
  id: string
  category: string
  chapter: string
  date: string
  before: { pre: string; mark: string; post: string }
  after: string
  note: string
}

/** ISO 문자열 → "MM.DD" (로컬 타임존). */
export function formatMonthDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}`
}

/**
 * error_cards 한 행 → 오류 카드 UI 데이터.
 * 저장 데이터는 구간(span) 단위이므로 원문 전체는 복원하지 않고 오류 구간만 마킹한다.
 * (문장 단위 before/after 복원은 후속 — session.draft_text 와 span 위치 매칭 필요.)
 */
export function mapErrorCard(row: ErrorCardRow): ErrorItemData {
  const category =
    row.error_subtype?.trim() || (row.error_type === 'vocab' ? '어휘' : '문법')
  const chapter = row.chapter_number > 0 ? `${row.chapter_number}과` : '자유 작문'
  return {
    id: row.id,
    category,
    chapter,
    date: formatMonthDay(row.created_at),
    before: { pre: '', mark: row.error_span, post: '' },
    after: row.correction?.trim() || row.error_span,
    note: row.explanation?.trim() || '',
  }
}

/** 정확도(%) = 해결한 오류 / 전체 오류. 분모 0 이면 0. */
export function accuracyPct(total: number, resolved: number): number {
  if (total <= 0) return 0
  return Math.round((resolved / total) * 100)
}

// ── 성장 탭 로더 ─────────────────────────────────────────────────────────────
export interface LeagueRowData {
  rank: number
  name: string
  xp: number
  me?: boolean
}

export interface GrowthData {
  level: number
  xp: number
  nextLevelXp: number
  leagueRows: LeagueRowData[]
  badges: BadgeItemData[]
  gemBalance: number
}

interface StatsRow {
  level: number
  xp: number
  activity_coins: number
}

export async function loadGrowthData(): Promise<GrowthData | null> {
  const ctx = await getAuthContext()
  if (!ctx) return null
  const supabase = createServerClient()

  const [statsRes, badgesRes, enrollRes] = await Promise.all([
    supabase
      .from('gamification_stats')
      .select('level, xp, activity_coins')
      .eq('student_id', ctx.userId)
      .maybeSingle(),
    supabase.from('badges').select('badge_type').eq('student_id', ctx.userId),
    supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', ctx.userId)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const stats = (statsRes.data as StatsRow | null) ?? {
    level: 1,
    xp: 0,
    activity_coins: 0,
  }
  const earnedTypes = ((badgesRes.data as { badge_type: string }[] | null) ?? []).map(
    (b) => b.badge_type
  )

  // 리그는 익명(닉네임)으로만 노출 — 실명 경쟁 금지(gamification-spec §0/M8).
  let leagueRows: LeagueRowData[] = []
  const classId = (enrollRes.data as { class_id: string } | null)?.class_id
  if (classId) {
    try {
      const standings = await getLeagueStandings(classId)
      leagueRows = standings.map((s) => ({
        rank: s.rank,
        name: s.nickname,
        xp: s.points,
        me: s.isMe,
      }))
    } catch {
      leagueRows = []
    }
  }

  return {
    level: stats.level,
    xp: stats.xp,
    nextLevelXp: nextLevelXp(stats.level) ?? stats.xp,
    leagueRows,
    badges: buildBadgeGrid(earnedTypes),
    gemBalance: stats.activity_coins,
  }
}

// ── 오류 탭 로더 ─────────────────────────────────────────────────────────────
export interface ErrorsData {
  items: ErrorItemData[]
  fixed: number
  accuracy: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function loadErrorsData(limit = 20): Promise<ErrorsData | null> {
  const ctx = await getAuthContext()
  if (!ctx) return null
  const supabase = createServerClient()
  const weekAgoIso = new Date(Date.now() - WEEK_MS).toISOString()

  const [listRes, totalRes, resolvedRes, weekFixedRes] = await Promise.all([
    supabase
      .from('error_cards')
      .select(
        'id, error_span, error_type, error_subtype, correction, explanation, chapter_number, created_at'
      )
      .eq('student_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('error_cards')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', ctx.userId),
    supabase
      .from('error_cards')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', ctx.userId)
      .eq('is_resolved', true),
    supabase
      .from('error_cards')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', ctx.userId)
      .eq('is_resolved', true)
      .gte('created_at', weekAgoIso),
  ])

  const rows = (listRes.data as ErrorCardRow[] | null) ?? []
  return {
    items: rows.map(mapErrorCard),
    fixed: weekFixedRes.count ?? 0,
    accuracy: accuracyPct(totalRes.count ?? 0, resolvedRes.count ?? 0),
  }
}
