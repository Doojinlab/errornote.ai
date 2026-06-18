// 반 협동 목표 (Class Co-op) — gamification-spec M8 / Phase G4.
// 긍정적 상호의존: 학생 개인의 졸업/개선이 반 전체 목표(특정 오류 유형 정복)에 +1 기여.
// 결석이 친구를 해치는 부정적 압박은 두지 않는다.
//
// 무결성: 기여(+1)는 SECURITY DEFINER RPC(contribute_class_goal, enrolled 가드) 경유.
// 목표 생성/수정은 교수자(owns_class) RLS 로 직접.

import { createServerClient } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function db(): SupabaseClient<Database> {
  return createServerClient() as unknown as SupabaseClient<Database>
}

export interface ClassGoal {
  id: string
  classId: string
  speciesId: string
  title: string
  targetCount: number
  currentCount: number
  periodStart: string
  periodEnd: string
  achieved: boolean
}

const GOAL_COLUMNS =
  'id, class_id, species_id, title, target_count, current_count, period_start, period_end, achieved'

function toClassGoal(row: {
  id: string
  class_id: string
  species_id: string
  title: string
  target_count: number
  current_count: number
  period_start: string
  period_end: string
  achieved: boolean
}): ClassGoal {
  return {
    id: row.id,
    classId: row.class_id,
    speciesId: row.species_id,
    title: row.title,
    targetCount: row.target_count,
    currentCount: row.current_count,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    achieved: row.achieved
  }
}

/** 반의 협동 목표 목록(마감 임박 순). */
export async function getClassGoals(classId: string): Promise<ClassGoal[]> {
  const { data, error } = await db()
    .from('class_goals')
    .select(GOAL_COLUMNS)
    .eq('class_id', classId)
    .order('period_end', { ascending: true })
  if (error) {
    throw new Error(`class_goals 조회 실패: ${error.message}`)
  }
  return (data as unknown as Parameters<typeof toClassGoal>[0][] | null ?? []).map(toClassGoal)
}

export interface ContributeResult {
  currentCount: number
  targetCount: number
  achieved: boolean
}

/**
 * 해당 오류 유형(code)을 졸업/개선했을 때 반 목표에 +1 기여.
 * 활성 목표가 없으면 조용히 no-op(currentCount=0, targetCount=0).
 */
export async function contributeClassGoal(classId: string, code: string): Promise<ContributeResult> {
  const { data, error } = await db().rpc('contribute_class_goal', {
    p_class_id: classId,
    p_code: code
  })
  if (error) {
    throw new Error(`contribute_class_goal RPC 실패: ${error.message}`)
  }
  const row = (data as unknown as Array<{ current_count: number; target_count: number; achieved: boolean }> | null)?.[0]
  if (!row) {
    throw new Error('contribute_class_goal 결과가 비어 있습니다')
  }
  return { currentCount: row.current_count, targetCount: row.target_count, achieved: row.achieved }
}
