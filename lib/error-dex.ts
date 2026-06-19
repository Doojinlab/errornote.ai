// 오류 도감 (Error Dex) — gamification-spec M1.
// 오류 유형(把字句·양사·어순 등)을 수집 가능한 误 몬스터로 다룬다.
// - 마스터 목록(error_species)은 전역 reference data.
// - 학습자별 수집 상태(user_dex_entries)는 RPC(record_dex_encounter) 로만 기록.

import { createServerClient } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type DexStatus = 'encountered' | 'tamed' | 'graduated'
/** 학습자 도감 셀의 상태. 아직 만난 적 없으면 'unseen'(미수집). */
export type DexCellStatus = DexStatus | 'unseen'

export interface ErrorSpecies {
  id: string
  code: string
  category: 'vocab' | 'grammar'
  name_zh: string
  name_ko: string
  hsk_level: number | null
  description: string
  sort_order: number
}

/** 마스터 종 + 학습자 본인의 수집 상태를 합친 도감 한 칸. */
export interface DexCell {
  species: ErrorSpecies
  status: DexCellStatus
  encounterCount: number
  graduatedAt: string | null
}

const SPECIES_COLUMNS =
  'id, code, category, name_zh, name_ko, hsk_level, description, sort_order'

/** 오류 도감 마스터 전체(정렬 순). */
export async function listErrorSpecies(): Promise<ErrorSpecies[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('error_species')
    .select(SPECIES_COLUMNS)
    .order('sort_order', { ascending: true })
  if (error) {
    throw new Error(`error_species 조회 실패: ${error.message}`)
  }
  return (data ?? []) as unknown as ErrorSpecies[]
}

/**
 * 학습자 도감: 마스터 종 전체에 본인의 수집 상태를 입혀 반환한다.
 * 아직 만난 적 없는 종은 status='unseen'(잠긴 칸).
 */
export async function getDex(studentId: string): Promise<DexCell[]> {
  const supabase = createServerClient()
  const [speciesRes, entriesRes] = await Promise.all([
    supabase
      .from('error_species')
      .select(SPECIES_COLUMNS)
      .order('sort_order', { ascending: true }),
    supabase
      .from('user_dex_entries')
      .select('species_id, status, encounter_count, graduated_at')
      .eq('student_id', studentId)
  ])

  if (speciesRes.error) {
    throw new Error(`error_species 조회 실패: ${speciesRes.error.message}`)
  }
  if (entriesRes.error) {
    throw new Error(`user_dex_entries 조회 실패: ${entriesRes.error.message}`)
  }

  const species = (speciesRes.data ?? []) as unknown as ErrorSpecies[]
  const entries = (entriesRes.data ?? []) as unknown as Array<{
    species_id: string
    status: DexStatus
    encounter_count: number
    graduated_at: string | null
  }>
  const bySpecies = new Map(entries.map((e) => [e.species_id, e]))

  return species.map((s) => {
    const entry = bySpecies.get(s.id)
    return {
      species: s,
      status: entry?.status ?? 'unseen',
      encounterCount: entry?.encounter_count ?? 0,
      graduatedAt: entry?.graduated_at ?? null
    }
  })
}

export interface DexEncounterResult {
  status: DexStatus
  encounterCount: number
}

/**
 * 误 몬스터 조우 기록. 오류가 발견됐을 때 해당 종(code)을 도감에 올리거나
 * encounter_count 를 올린다. graduated 항목은 되돌아가지 않는다(RPC 내부 처리).
 */
export async function recordDexEncounter(
  studentId: string,
  code: string
): Promise<DexEncounterResult> {
  // @supabase/ssr 0.5.x 의 createServerClient 반환 타입이 설치된 supabase-js 2.105 의
  // SupabaseClient 제네릭 arity 와 어긋나 .rpc() 의 Args 추론이 깨진다(args→undefined).
  // 정상 타입으로 좁혀 호출한다. (근본 해결: @supabase/ssr 업그레이드 — #53 참조)
  const supabase = createServerClient() as unknown as SupabaseClient<Database>
  const { data, error } = await supabase.rpc('record_dex_encounter', {
    p_student_id: studentId,
    p_code: code
  })
  if (error) {
    throw new Error(`record_dex_encounter RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{ status: DexStatus; encounter_count: number }> | null)?.[0]
  if (!row) {
    throw new Error('record_dex_encounter 결과가 비어 있습니다')
  }
  return { status: row.status, encounterCount: row.encounter_count }
}
