// 학생 탭(오류·성장) 실데이터 로더 + 순수 매핑 헬퍼.
// 리디자인 화면(스펙 §5)의 더미 데이터를 실제 Supabase 데이터로 교체한다.
// - 순수 함수(buildBadgeGrid/mapErrorCard/accuracyPct/formatMonthDay)는 단위 테스트 대상.
// - 로더(loadGrowthData/loadErrorsData/loadLearnData)는 서버 컴포넌트에서만 호출(인증 세션 필요).
//   부수효과를 피하기 위해 gamification_stats 는 select 만 한다(레이아웃 loadStats 와 동일 패턴).

import { createServerClient } from './supabase'
import { getAuthContext } from './auth'
import { nextLevelXp } from './gamification'
import { getLeagueStandings } from './league'
import { getChapterConfig } from './prompts'
import { listAssignmentsForStudent } from './assignments'
import { listAssignedReviews } from './peer-review'
import type {
  Card1ErrorsData,
  Card2ImprovedData,
  Card3TodoNowData,
  Card4NextWeekData,
} from '@/types/cardnews'

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

// ── 학습(홈) 탭 ──────────────────────────────────────────────────────────────
// 더미(learnData.getLearnHomeData)를 대체. 화면 셸/컴포넌트는 그대로 두고 데이터만 실연동.

export type CardNewsTone = 'blue' | 'jade' | 'gold' | 'gem'

export interface CardNewsItem {
  id: string
  tag: string
  title: string
  /** 보조 한 줄(한국어). 주간 리포트 요약 등 — zh 가 없을 때 본문으로 노출. */
  summary?: string
  /** 중국어 예문(있을 때만 font-cn 렌더). 주간 리포트엔 없음. */
  zh?: string
  tone: CardNewsTone
}

export interface LearnTasks {
  assignmentTitle: string
  /** 다음 미제출 과제까지 남은 일수. 예정 과제 없으면 null → 배지 숨김. */
  assignmentDueInDays: number | null
  peerReviewDesc: string
  /** 대기 중 동료 리뷰 수. 0 이면 배지 숨김. */
  peerReviewCount: number
}

export interface LearnTodayChapter {
  chapterId: number
  title: string
  subtitle: string
}

export interface LearnHomeData {
  studentName: string
  /** 활성 수업 등록 여부. false → 빈 상태(초대코드) 화면. */
  hasActiveClass: boolean
  goal: { current: number; total: number }
  streakDays: number
  gems: number
  today: LearnTodayChapter
  tasks: LearnTasks
  cardNews: CardNewsItem[]
}

/** 하루 목표 교정 문장 수(잠정 기본값 — 추후 수업/사용자 설정으로 대체). */
export const DEFAULT_DAILY_GOAL = 5

/**
 * 챕터 번호 → "오늘의 학습" 히어로 문구.
 * subtitle 은 lib/prompts 의 chapterFocus 첫 줄("제N장 — 제목 (…)")에서 제목만 추출.
 */
export function chapterTeaser(chapterNumber: number): LearnTodayChapter {
  const cfg = getChapterConfig(chapterNumber)
  const firstLine = cfg?.chapterFocus.split('\n')[0]?.trim() ?? ''
  const dash = firstLine.indexOf('—')
  const afterDash = dash >= 0 ? firstLine.slice(dash + 1) : firstLine
  const subtitle = afterDash.replace(/\s*\(.*$/, '').trim() || '오늘도 한 문장씩 시작해요'
  const title =
    chapterNumber <= 0 ? '오늘의 학습 · 기초' : `오늘의 학습 · ${chapterNumber}과`
  return { chapterId: Math.max(chapterNumber, 0), title, subtitle }
}

/**
 * "오늘의 학습" 챕터 선정 — 잠정 규칙: 최근 오류가 가장 많은 챕터(=보강 필요).
 * 무오류면 가장 최근 학습 세션 챕터, 그것도 없으면 0(기초).
 * ⚠️ 제품 결정 잠정값 — 추후 커리큘럼/진도 기준으로 교체.
 */
export function pickFocusChapter(
  errorChapters: number[],
  lastSessionChapter: number | null
): number {
  const counts = new Map<number, number>()
  for (const c of errorChapters) {
    if (!Number.isInteger(c)) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  for (const [chap, n] of counts) {
    if (n > bestCount) {
      best = chap
      bestCount = n
    }
  }
  if (best !== null) return best
  return lastSessionChapter ?? 0
}

/** 주간 리포트(weekly_cardnews) 4파트 → 학습 홈 카드뉴스 레일 티저(요약 중심). */
export function mapCardnewsTeasers(cards: {
  card1: Card1ErrorsData | null
  card2: Card2ImprovedData | null
  card3: Card3TodoNowData | null
  card4: Card4NextWeekData | null
}): CardNewsItem[] {
  const items: CardNewsItem[] = []
  if (cards.card1) {
    items.push({
      id: 'cn-errors',
      tag: '이번 주 오류',
      title: cards.card1.week_summary?.trim() || '이번 주 오류 리포트',
      summary: `문법 ${cards.card1.grammar_count} · 어휘 ${cards.card1.vocab_count} · 총 ${cards.card1.total_errors}건`,
      tone: 'blue',
    })
  }
  if (cards.card2) {
    items.push({
      id: 'cn-improved',
      tag: '가장 개선됨',
      title: cards.card2.headline?.trim() || '잘하고 있어요',
      summary: cards.card2.positive_note?.trim() || undefined,
      tone: 'jade',
    })
  }
  if (cards.card3) {
    items.push({
      id: 'cn-todo',
      tag: '지금 할 것',
      title: cards.card3.action_title?.trim() || '오늘의 미션',
      summary: `${cards.card3.estimated_minutes}분 · 목표 ${cards.card3.goal_progress_percent}%`,
      tone: 'gold',
    })
  }
  if (cards.card4) {
    items.push({
      id: 'cn-next',
      tag: '다음 주',
      title: cards.card4.next_chapter_title?.trim() || '다음 주 학습',
      summary:
        cards.card4.preview_points?.[0]?.trim() ||
        cards.card4.focus_grammar?.trim() ||
        undefined,
      tone: 'gem',
    })
  }
  return items
}

interface LearnStatsRow {
  streak_days: number
  activity_coins: number
}

interface CardnewsTeaserRow {
  card1_data: Card1ErrorsData | null
  card2_data: Card2ImprovedData | null
  card3_data: Card3TodoNowData | null
  card4_data: Card4NextWeekData | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function loadLearnData(): Promise<LearnHomeData | null> {
  const ctx = await getAuthContext()
  if (!ctx) return null
  const supabase = createServerClient()
  const userId = ctx.userId

  // 성능: 홈은 매 진입마다 렌더된다. 예전엔 (프로필+등록) 조회 → classId 확인 → 나머지 7개
  // 조회로 **2번의 네트워크 왕복 그룹**이 발생했다. 2번째 그룹의 쿼리는 전부 userId(=ctx)만
  // 참조하고 classId 에 의존하지 않으므로, 전부 한 번의 Promise.all 로 합쳐 왕복을 1회로 줄인다.
  // (활성 수업이 없는 드문 경우엔 가벼운 count/select 몇 개가 낭비되지만, 다수인 활성 수업
  //  학생의 홈 로딩에서 왕복 1회를 통째로 절약한다.)
  const todayStartIso = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
  const monthAgoIso = new Date(Date.now() - 30 * DAY_MS).toISOString()

  const [
    profileRes,
    enrollRes,
    statsRes,
    todayCountRes,
    lastSessRes,
    errChapRes,
    cardnewsRes,
    assignments,
    reviews,
  ] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', userId).maybeSingle(),
    supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', userId)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('gamification_stats')
      .select('streak_days, activity_coins')
      .eq('student_id', userId)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId)
      .gte('created_at', todayStartIso),
    supabase
      .from('sessions')
      .select('chapter_number')
      .eq('student_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('error_cards')
      .select('chapter_number')
      .eq('student_id', userId)
      .gte('created_at', monthAgoIso),
    supabase
      .from('weekly_cardnews')
      .select('card1_data, card2_data, card3_data, card4_data')
      .eq('student_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    listAssignmentsForStudent(userId).catch(() => []),
    listAssignedReviews(userId).catch(() => []),
  ])

  const studentName =
    ((profileRes.data as { name: string | null } | null)?.name ?? '').trim() || '학생'
  const classId = (enrollRes.data as { class_id: string } | null)?.class_id ?? null

  // 활성 수업 없음 → 빈 상태. 나머지 조회 생략(신규/미배정 학생의 불필요 쿼리 방지 — 테스트로 고정된 불변식).
  if (!classId) {
    return {
      studentName,
      hasActiveClass: false,
      goal: { current: 0, total: DEFAULT_DAILY_GOAL },
      streakDays: 0,
      gems: 0,
      today: chapterTeaser(0),
      tasks: {
        assignmentTitle: '',
        assignmentDueInDays: null,
        peerReviewDesc: '',
        peerReviewCount: 0,
      },
      cardNews: [],
    }
  }

  const stats = (statsRes.data as LearnStatsRow | null) ?? {
    streak_days: 0,
    activity_coins: 0,
  }

  // 오늘의 학습 챕터(잠정 규칙).
  const errChapters = ((errChapRes.data as { chapter_number: number | null }[] | null) ?? [])
    .map((r) => r.chapter_number)
    .filter((n): n is number => typeof n === 'number')
  const lastChapter =
    (lastSessRes.data as { chapter_number: number | null } | null)?.chapter_number ?? null
  const today = chapterTeaser(pickFocusChapter(errChapters, lastChapter))

  // 다음 미제출 과제(마감 임박순).
  const pending = assignments
    .filter((a) => !a.submitted && a.assignment.due_date)
    .sort(
      (a, b) =>
        Date.parse(a.assignment.due_date as string) -
        Date.parse(b.assignment.due_date as string)
    )
  const next = pending[0] ?? null
  const dueInDays = next
    ? Math.max(
        0,
        Math.ceil((Date.parse(next.assignment.due_date as string) - Date.now()) / DAY_MS)
      )
    : null

  const pendingReviews = reviews.filter((r) => r.status !== 'completed').length

  const cnRow = cardnewsRes.data as CardnewsTeaserRow | null
  const cardNews = cnRow
    ? mapCardnewsTeasers({
        card1: cnRow.card1_data,
        card2: cnRow.card2_data,
        card3: cnRow.card3_data,
        card4: cnRow.card4_data,
      })
    : []

  return {
    studentName,
    hasActiveClass: true,
    goal: { current: todayCountRes.count ?? 0, total: DEFAULT_DAILY_GOAL },
    streakDays: stats.streak_days ?? 0,
    gems: stats.activity_coins ?? 0,
    today,
    tasks: {
      assignmentTitle: next?.assignment.title ?? '예정된 과제가 없어요',
      assignmentDueInDays: dueInDays,
      peerReviewDesc:
        pendingReviews > 0 ? `친구 글 ${pendingReviews}편 리뷰하기` : '지금은 리뷰할 글이 없어요',
      peerReviewCount: pendingReviews,
    },
    cardNews,
  }
}
