// 今日热词 — 서버 로직 (docs/dashboard-features.md §2)
//
// · getTodayHotword       : 관심분야 개인화 배포(현재는 신선도 기준) — 학생이 비추한 카드 제외
// · recordImpression      : 고유 노출 집계(학생×카드 1회) — like_rate 분모
// · recordVote            : 좋았어요/비추 1인 1표 + 집계 캐시 갱신 + 비율 판정
// · evaluateHotwordLifecycle : §2.5 비율 판정 → 노출 연장 / 동면(cooldown)
// · runHotwordPipeline    : §2.4 완전 자동 파이프라인 5단계 — 구조 스켈레톤(수집은 미연동)
//
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

// ── 비율 판정 임계값 (§2.5) ────────────────────────────────
// 원안의 "좋았어요/비추 10개"는 판정이 유의미해지는 최소 문턱으로 사용.
// 실측 튜닝 대상(§3): 초기값은 보수적으로 잡는다.
export const MIN_SAMPLE = 30
export const LIKE_THRESHOLD = 0.6
export const DISLIKE_THRESHOLD = 0.3

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

/**
 * 오늘의 단어 — active 풀에서 신선도 순으로, 학생이 비추(dislike)한 카드는 제외.
 * 관심분야 개인화는 관심분야 저장 후 category 필터로 확장 예정(§3).
 */
export async function getTodayHotword(studentId: string): Promise<Hotword | null> {
  const supabase = createServerClient()

  const { data: rows } = await supabase
    .from('hotwords')
    .select('*')
    .eq('status', 'active')
    .order('first_seen', { ascending: false })
    .limit(20)

  if (!rows || rows.length === 0) return null

  // 본인이 비추한 카드는 노출에서 제외(RLS self — 본인 표만 조회됨).
  const { data: votes } = await supabase
    .from('hotword_feedback')
    .select('hotword_id, vote')
    .eq('student_id', studentId)
    .eq('vote', 'dislike')

  const disliked = new Set((votes ?? []).map((v) => v.hotword_id))
  const pick = rows.find((r) => !disliked.has(r.id)) ?? rows[0]
  return mapHotword(pick)
}

/** 입장 컨텍스트 구성용 — active 단건 조회(RLS: active 만 노출). */
export async function getActiveHotwordById(id: string): Promise<Hotword | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('hotwords')
    .select('*')
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
    await admin.from('hotwords').update({ status: 'dormant' }).eq('id', row.id)
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

// ============================================================
// §2.4 완전 자동 파이프라인 (5단계) — fail-closed 구조 스켈레톤
// ============================================================
// 원칙: 확신 없으면 내보내지 않는다(게이트의 침묵이 사람 검수를 대신).
// 현재 슬라이스는 구조만 확정하고 실제 수집(1단계)은 미연동이다(§3: web search 연동 방식 미해결).
// 시드 데이터로 대시보드를 구동하며, 아래 단계 함수를 뒤에 채운다.

export interface HotwordCandidate {
  term: string
  category: HotwordCategory
  sources: HotwordSource[]
}

/** 1. 수집 — 관심분야별 web search(微博/小红书/抖音/知乎). 넓게 수집. */
export async function collectCandidates(_category: HotwordCategory): Promise<HotwordCandidate[]> {
  // TODO(§3): web search 연동. 지금은 미연동 → 빈 배열(시드로 구동).
  return []
}

/** 2. 실재검증(게이트①) — 서로 다른 출처 2곳↑ + 최근 2~3개월. 근거 약하면 폐기. */
export function passesExistenceGate(c: HotwordCandidate): boolean {
  const distinctSources = new Set(c.sources.map((s) => s.name)).size
  return distinctSources >= 2
}

/** 5. 큐레이션·배포 — 중복 제거 → 신선도 정렬 → 분야별 풀 → 관심분야 개인화 배포. */
// 3.해설생성 · 4.안전·격식필터 는 수집 연동 시 dispatchJSON 로 채운다(백지 생성 금지).
