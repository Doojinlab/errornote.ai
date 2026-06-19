// 오답 졸업 (Graduation) — gamification-spec M6, §1.2 닫힘 루프 완성.
// 화석화됐던(총 ≥ FOSSILIZATION_THRESHOLD) 오류 유형이 최근 GRADUATION_QUIET_DAYS 일간
// 재발하지 않으면 "졸업"으로 판정 → mastery_points 적립 + 도감 graduated + 졸업식 알림.

import { createServerClient, createAdminClient } from './supabase'
import { awardMasteryPoints } from './gamification'
import { createInAppNotification } from './in-app-notifications'
import { FOSSILIZATION_THRESHOLD } from './fossilization'
import { ymd } from './daily-quests'

/** 마지막 재발 이후 이 일수만큼 조용하면 졸업으로 본다. */
export const GRADUATION_QUIET_DAYS = 14
/** 졸업 1건당 적립되는 숙련 화폐. companion 진화(임계 3/8/20)와 맞물린다. */
export const GRADUATION_MASTERY_REWARD = 5

/**
 * error_subtype(자유 텍스트)를 error_species code(슬러그)로 best-effort 매핑한다.
 * subtype 안에 종 키워드가 포함되면 해당 종으로 본다. 매핑 불가 시 null.
 */
const SPECIES_KEYWORDS: ReadonlyArray<{ code: string; keywords: string[] }> = [
  { code: 'ba_construction', keywords: ['把자문', '把字句', '把자'] },
  { code: 'word_order', keywords: ['어순', '语序', '어순 오류'] },
  { code: 'measure_word', keywords: ['양사', '量词'] },
  { code: 'separable_verb', keywords: ['이합사', '离合词'] },
  { code: 'shi_de', keywords: ['是…的', '是...的', '是的 구문'] },
  { code: 'complement', keywords: ['보어', '补语'] },
  { code: 'function_word', keywords: ['허사', '虚词', '개사', '접속사'] },
  { code: 'wrong_word', keywords: ['错词', '오어', '잘못된 단어', '错字'] },
  { code: 'missing_word', keywords: ['缺词', '결어', '누락'] },
  { code: 'redundant_word', keywords: ['多词', '잉여', '중복'] },
  { code: 'collocation', keywords: ['搭配', '연어', '호응'] },
  // '了' 는 단독 매칭이 과하게 잡혀(예: '잘못된...') 마지막에, 정확 키워드만.
  { code: 'le_usage', keywords: ['了 용법', '了的使用', '동태조사 了', '어기조사 了'] }
]

export function resolveSpeciesCode(subtype: string): string | null {
  const s = (subtype ?? '').trim()
  if (!s) return null
  for (const { code, keywords } of SPECIES_KEYWORDS) {
    if (keywords.some((k) => s.includes(k))) return code
  }
  return null
}

export interface GraduatedSpecies {
  code: string
  subtype: string
}

interface SubtypeStat {
  subtype: string
  count: number
  lastSeen: string
}

/** 학습자 error_cards 를 subtype 별 (count, lastSeen) 으로 집계. */
async function aggregateSubtypeHistory(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string
): Promise<SubtypeStat[]> {
  const { data, error } = await supabase
    .from('error_cards')
    .select('error_subtype, created_at')
    .eq('student_id', studentId)
  if (error) {
    throw new Error(`error_cards 조회 실패: ${error.message}`)
  }
  const rows = (data ?? []) as Array<{ error_subtype: string | null; created_at: string }>
  const map = new Map<string, SubtypeStat>()
  for (const r of rows) {
    const subtype = (r.error_subtype ?? '').trim()
    if (!subtype) continue
    const prev = map.get(subtype)
    if (!prev) {
      map.set(subtype, { subtype, count: 1, lastSeen: r.created_at })
    } else {
      prev.count += 1
      if (r.created_at > prev.lastSeen) prev.lastSeen = r.created_at
    }
  }
  return [...map.values()]
}

/**
 * 졸업 후보를 판정하고, 처음 졸업하는 종에 대해 mastery 적립 + 졸업식 알림을 발송한다.
 * 멱등: record_dex_graduation 이 newly_graduated=false 면 보상/알림을 건너뛴다.
 *
 * 호출: 서버 컨텍스트(데일리 퀘스트 API 등). RLS self 클라이언트로 읽고,
 * 적립/알림은 service-role(admin)로 수행한다.
 *
 * @param nowIso 판정 기준 시각(테스트 주입용). 미지정 시 현재.
 */
export async function processGraduations(
  studentId: string,
  nowIso?: string
): Promise<GraduatedSpecies[]> {
  const supabase = createServerClient()
  const stats = await aggregateSubtypeHistory(supabase, studentId)

  const now = nowIso ? new Date(nowIso) : new Date()
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - GRADUATION_QUIET_DAYS)
  const cutoffYmd = ymd(cutoff)

  // 화석화됐고(>=임계) 최근 조용한 subtype → 종 코드로 매핑(중복 코드 제거).
  const codeToSubtype = new Map<string, string>()
  for (const st of stats) {
    if (st.count < FOSSILIZATION_THRESHOLD) continue
    if (ymd(new Date(st.lastSeen)) >= cutoffYmd) continue // 최근 재발 → 아직 졸업 아님
    const code = resolveSpeciesCode(st.subtype)
    if (!code) continue
    if (!codeToSubtype.has(code)) codeToSubtype.set(code, st.subtype)
  }
  if (codeToSubtype.size === 0) return []

  const admin = createAdminClient()
  const graduated: GraduatedSpecies[] = []

  for (const [code, subtype] of codeToSubtype) {
    const { data, error } = await admin.rpc('record_dex_graduation', {
      p_student_id: studentId,
      p_code: code
    })
    if (error) {
      throw new Error(`record_dex_graduation RPC 실패: ${error.message}`)
    }
    const newly = (data as unknown as Array<{ newly_graduated: boolean }> | null)?.[0]?.newly_graduated
    if (!newly) continue

    // 처음 졸업 — 숙련 화폐 + 졸업식 알림.
    await awardMasteryPoints(studentId, GRADUATION_MASTERY_REWARD)
    await createInAppNotification(admin, {
      userId: studentId,
      type: 'dex_graduation',
      title: '🎓 오류 하나를 졸업했어요!',
      body: `'${subtype}' 유형을 극복했어요. 误 동반자가 한 뼘 자랐어요.`,
      linkUrl: '/badges',
      payload: { code, subtype }
    }).catch(() => {})

    graduated.push({ code, subtype })
  }

  return graduated
}
