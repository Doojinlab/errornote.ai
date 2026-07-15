// 今日热词 — 서버 로직 (docs/dashboard-features.md §2)
//
// · getTodayHotword       : 관심분야 개인화 배포(미설정 시 신선도) — 학생이 비추한 카드 제외
// · getInterests/setInterests : 관심분야 조회·저장(§2.1)
// · recordImpression      : 고유 노출 집계(학생×카드 1회) — like_rate 분모
// · recordVote            : 좋았어요/비추 1인 1표 + 집계 캐시 갱신 + 비율 판정
// · evaluateHotwordLifecycle : §2.5 비율 판정 → 노출 연장 / 동면(cooldown)
// · reactivateDormant     : §3 냉각 경과 동면 카드 재등판
//
// §2.4 완전 자동 파이프라인(수집·해설·안전필터·배포)은 lib/hotword-pipeline.ts 에 구현됨.
// 기존 weekly_cardnews 로직·테이블은 일절 사용하지 않는다.

import { createAdminClient, createServerClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type {
  Hotword,
  HotwordCategory,
  HotwordSource,
  HotwordVote,
  HotwordVoteResult,
} from '@/types/hotwords'

type HotwordRow = Database['public']['Tables']['hotwords']['Row']

// ── 비율 판정 임계값 (§2.5) — env 로 실측 튜닝(§3) ──────────
// 원안의 "좋았어요/비추 10개"는 판정이 유의미해지는 최소 문턱으로 사용.
// 배포 없이 조정할 수 있도록 환경변수로 오버라이드(미설정 시 보수적 기본값).
function numEnv(name: string, def: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : def
}
export const MIN_SAMPLE = numEnv('HOTWORD_MIN_SAMPLE', 30)
export const LIKE_THRESHOLD = numEnv('HOTWORD_LIKE_THRESHOLD', 0.6)
export const DISLIKE_THRESHOLD = numEnv('HOTWORD_DISLIKE_THRESHOLD', 0.3)
// 동면(cooldown) 후 재등판까지의 냉각 기간(일). §3 재등판 정책.
export const HOTWORD_COOLDOWN_DAYS = numEnv('HOTWORD_COOLDOWN_DAYS', 30)
// 노출 신선도 창(일).
const EXPOSURE_DAYS = 21

// hotwords 전체 컬럼 명시 — select('*') 대신 명시적으로 나열(스키마 변경에 안전).
const HOTWORD_COLS =
  'id, term, category, pinyin, literal, meaning, example, origin, register_tag, sources, first_seen, status, exposure_until, dormant_at, impressions, likes, dislikes, created_at'

export const HOTWORD_CATEGORY_LABEL: Record<HotwordCategory, string> = {
  game: '게임',
  entertainment: '연예',
  society: '사회',
  economy: '경제',
  daily: '일상',
  meme: '밈',
}

function toSources(raw: HotwordRow['sources']): HotwordSource[] {
  return Array.isArray(raw) ? (raw as unknown as HotwordSource[]) : []
}

export function mapHotword(row: HotwordRow): Hotword {
  return {
    id: row.id,
    term: row.term,
    category: row.category,
    pinyin: row.pinyin,
    literal: row.literal,
    meaning: row.meaning,
    example: row.example,
    origin: row.origin,
    registerTag: row.register_tag,
    sources: toSources(row.sources),
    firstSeen: row.first_seen,
    status: row.status,
    exposureUntil: row.exposure_until,
    impressions: row.impressions,
    likes: row.likes,
    dislikes: row.dislikes,
  }
}

/** 학생의 관심분야 조회(§2.1). 미설정이면 빈 배열. */
export async function getInterests(studentId: string): Promise<HotwordCategory[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('student_hotword_interests')
    .select('category')
    .eq('student_id', studentId)
  return (data ?? []).map((r) => r.category)
}

/** 관심분야 저장(전체 교체). 유효 카테고리만 반영. */
export async function setInterests(
  studentId: string,
  categories: HotwordCategory[],
): Promise<void> {
  const supabase = createServerClient()
  const valid = Array.from(new Set(categories)).filter((c) =>
    (Object.keys(HOTWORD_CATEGORY_LABEL) as HotwordCategory[]).includes(c),
  )
  // 전체 교체 — 기존 삭제 후 재삽입(RLS self).
  await supabase.from('student_hotword_interests').delete().eq('student_id', studentId)
  if (valid.length > 0) {
    await supabase
      .from('student_hotword_interests')
      .insert(valid.map((category) => ({ student_id: studentId, category })))
  }
}

/**
 * 오늘의 단어 — active 풀에서 신선도 순으로, 학생이 비추(dislike)한 카드는 제외.
 * 관심분야가 설정돼 있으면 해당 분야로 개인화(§2.1). 결과가 없으면 전 분야로 폴백.
 */
export async function getTodayHotword(studentId: string): Promise<Hotword | null> {
  const supabase = createServerClient()

  // 관심분야·비추 표를 병렬 조회(순차 왕복 제거).
  const [interests, votesRes] = await Promise.all([
    getInterests(studentId),
    supabase
      .from('hotword_feedback')
      .select('hotword_id')
      .eq('student_id', studentId)
      .eq('vote', 'dislike'),
  ])

  // 명시 컬럼(HOTWORD_COLS)으로 조회. 관심분야 필터는 선택적.
  const runQuery = async (categories: HotwordCategory[] | null) => {
    let q = supabase.from('hotwords').select(HOTWORD_COLS).eq('status', 'active')
    if (categories && categories.length > 0) q = q.in('category', categories)
    const { data } = await q.order('first_seen', { ascending: false }).limit(20)
    return data ?? []
  }

  // 관심분야 우선 → 없으면 전 분야 폴백.
  let rows = await runQuery(interests.length > 0 ? interests : null)
  if (rows.length === 0 && interests.length > 0) rows = await runQuery(null)
  if (rows.length === 0) return null

  const disliked = new Set((votesRes.data ?? []).map((v) => v.hotword_id))
  const pick = rows.find((r) => !disliked.has(r.id)) ?? rows[0]
  return mapHotword(pick)
}

/** 입장 컨텍스트 구성용 — active 단건 조회(RLS: active 만 노출). */
export async function getActiveHotwordById(id: string): Promise<Hotword | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('hotwords')
    .select(HOTWORD_COLS)
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()
  return data ? mapHotword(data) : null
}

/**
 * 고유 노출 집계 — 학생×카드 1회. 중복 노출은 무시(멱등).
 * 카운터 증가는 RLS 우회가 필요하므로 admin 으로 처리한다.
 */
export async function recordImpression(studentId: string, hotwordId: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('hotword_impressions')
    .insert({ hotword_id: hotwordId, student_id: studentId })

  // 이미 노출 집계된 카드(unique 위반 23505)면 카운터를 올리지 않는다.
  if (error) {
    if (error.code === '23505') return
    throw error
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('hotwords')
    .select('impressions')
    .eq('id', hotwordId)
    .maybeSingle()
  if (row) {
    await admin
      .from('hotwords')
      .update({ impressions: row.impressions + 1 })
      .eq('id', hotwordId)
  }
}

/**
 * 좋았어요/비추 — 1인 1표(계정×카드 1회). 표를 바꾸면 갱신한다.
 * 집계 캐시(likes/dislikes)는 전체 표를 세야 하므로 admin 으로 재계산한다.
 */
export async function recordVote(
  studentId: string,
  hotwordId: string,
  vote: HotwordVote,
): Promise<HotwordVoteResult> {
  const supabase = createServerClient()

  // upsert — (hotword_id, student_id) unique 로 1인 1표 보장. 표 변경 시 vote 갱신.
  const { error: upsertErr } = await supabase
    .from('hotword_feedback')
    .upsert(
      { hotword_id: hotwordId, student_id: studentId, vote },
      { onConflict: 'hotword_id,student_id' },
    )
  if (upsertErr) throw upsertErr

  // 집계 캐시 재계산(admin — 다른 학생 표까지 세야 함).
  const admin = createAdminClient()
  const [{ count: likes }, { count: dislikes }] = await Promise.all([
    admin
      .from('hotword_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('hotword_id', hotwordId)
      .eq('vote', 'like'),
    admin
      .from('hotword_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('hotword_id', hotwordId)
      .eq('vote', 'dislike'),
  ])

  const likeCount = likes ?? 0
  const dislikeCount = dislikes ?? 0

  await admin
    .from('hotwords')
    .update({ likes: likeCount, dislikes: dislikeCount })
    .eq('id', hotwordId)

  const { data: fresh } = await admin
    .from('hotwords')
    .select('*')
    .eq('id', hotwordId)
    .maybeSingle()

  const dormant = fresh ? await evaluateHotwordLifecycle(fresh) : false

  return { vote, likes: likeCount, dislikes: dislikeCount, dormant }
}

/**
 * §2.5 비율 판정 — 절대값 아닌 비율로. 최소 표본(MIN_SAMPLE) 미만이면 판정 보류.
 *  · dislike_rate >= DISLIKE_THRESHOLD → 빠른 교체 = 동면(status='dormant'). 삭제 아님.
 *  · like_rate    >= LIKE_THRESHOLD    → 노출기간 +1일.
 * 반환값: 이번 판정으로 동면 처리됐는지.
 */
export async function evaluateHotwordLifecycle(row: HotwordRow): Promise<boolean> {
  if (row.impressions < MIN_SAMPLE) return false

  const likeRate = row.likes / row.impressions
  const dislikeRate = row.dislikes / row.impressions
  const admin = createAdminClient()

  if (dislikeRate >= DISLIKE_THRESHOLD) {
    // 동면 전환 시각 기록 → 냉각 기간 계산 근거(재등판 정책).
    await admin
      .from('hotwords')
      .update({ status: 'dormant', dormant_at: new Date().toISOString() })
      .eq('id', row.id)
    return true
  }

  if (likeRate >= LIKE_THRESHOLD) {
    const base = row.exposure_until ? new Date(row.exposure_until) : new Date()
    base.setDate(base.getDate() + 1)
    const next = base.toISOString().slice(0, 10)
    await admin.from('hotwords').update({ exposure_until: next }).eq('id', row.id)
  }

  return false
}

/**
 * §3 동면 재등판 정책 — 냉각 기간이 지난 동면 카드를 새 시도 기회와 함께 active 로 복귀.
 * 삭제가 아니므로 카운터·피드백·노출 로그를 리셋해 공정한 재시도가 되게 한다.
 * 반환값: 재등판한 카드 수.
 */
export async function reactivateDormant(
  cooldownDays: number = HOTWORD_COOLDOWN_DAYS,
): Promise<number> {
  const admin = createAdminClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cooldownDays)

  const { data: due } = await admin
    .from('hotwords')
    .select('id')
    .eq('status', 'dormant')
    .not('dormant_at', 'is', null)
    .lt('dormant_at', cutoff.toISOString())

  const ids = (due ?? []).map((r) => r.id)
  if (ids.length === 0) return 0

  // 공정한 재시도 — 이전 노출/표 리셋.
  await admin.from('hotword_impressions').delete().in('hotword_id', ids)
  await admin.from('hotword_feedback').delete().in('hotword_id', ids)

  const exposureUntil = new Date()
  exposureUntil.setDate(exposureUntil.getDate() + EXPOSURE_DAYS)

  const { error } = await admin
    .from('hotwords')
    .update({
      status: 'active',
      dormant_at: null,
      impressions: 0,
      likes: 0,
      dislikes: 0,
      exposure_until: exposureUntil.toISOString().slice(0, 10),
    })
    .in('id', ids)

  if (error) {
    console.error('[hotwords] 재등판 실패:', error)
    return 0
  }
  return ids.length
}

// §2.4 완전 자동 파이프라인(수집·실재검증·해설·안전필터·배포)은 lib/hotword-pipeline.ts 참조.
