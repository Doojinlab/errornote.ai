// AI 튜터 — 학습자 오류 프로필 집계 (#48 멀티턴 컨텍스트 강화).
// 최근 오류 카드를 모아 "반복 유형 / 화석화 위험 / HSK 범위"로 요약한다.
// 이 프로필을 튜터 시스템 프롬프트에 주입해 "내 오류를 아는 튜터"를 만든다.
//
// errornote 의 해자: 모든 개인화가 학습자 본인의 오류 프로필에서 나온다.

import { createServerClient } from './supabase'
import { FOSSILIZATION_THRESHOLD } from './fossilization'

type Sb = ReturnType<typeof createServerClient>

/** 프로필 집계에 쓸 최근 오류 카드 수. */
export const PROFILE_RECENT_LIMIT = 100
/** 프롬프트에 노출할 반복 유형 상위 N개. */
export const PROFILE_TOP_N = 5

export interface LearnerProfileItem {
  subtype: string
  count: number
  /** 반복 횟수가 화석화 임계 이상 */
  fossilized: boolean
}

export interface LearnerProfile {
  /** 반복 빈도 상위 유형(내림차순) */
  recurring: LearnerProfileItem[]
  /** 최근 오류의 HSK 급수 범위 */
  hskRange: { min: number; max: number } | null
  /** 집계에 사용된 최근 오류 카드 수 */
  totalRecent: number
}

/** 최근 오류 카드를 subtype 별로 집계해 학습자 프로필을 만든다. */
export async function aggregateLearnerProfile(
  supabase: Sb,
  studentId: string
): Promise<LearnerProfile> {
  const { data, error } = await supabase
    .from('error_cards')
    .select('error_subtype, hsk_level')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(PROFILE_RECENT_LIMIT)
  if (error) {
    throw new Error(`error_cards 프로필 집계 실패: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{ error_subtype: string | null; hsk_level: number | null }>

  const counts = new Map<string, number>()
  let hskMin: number | null = null
  let hskMax: number | null = null
  for (const r of rows) {
    const label = (r.error_subtype ?? '').trim()
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
    if (typeof r.hsk_level === 'number') {
      hskMin = hskMin === null ? r.hsk_level : Math.min(hskMin, r.hsk_level)
      hskMax = hskMax === null ? r.hsk_level : Math.max(hskMax, r.hsk_level)
    }
  }

  const recurring: LearnerProfileItem[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PROFILE_TOP_N)
    .map(([subtype, count]) => ({
      subtype,
      count,
      fossilized: count >= FOSSILIZATION_THRESHOLD
    }))

  return {
    recurring,
    hskRange: hskMin !== null && hskMax !== null ? { min: hskMin, max: hskMax } : null,
    totalRecent: rows.length
  }
}

/**
 * 학습자 프로필을 튜터 시스템 프롬프트용 섹션 문자열로 만든다(순수).
 * 반복 유형이 없으면 null(주입 생략).
 */
export function buildLearnerProfileSection(profile: LearnerProfile): string | null {
  if (profile.recurring.length === 0) return null

  const lines = profile.recurring.map((it) => {
    const tag = it.fossilized ? ' (화석화 위험 — 집중 교정 필요)' : ''
    return `- ${it.subtype}: ${it.count}회${tag}`
  })

  const hsk = profile.hskRange
    ? `\n최근 오류의 HSK 급수 범위: ${profile.hskRange.min}~${profile.hskRange.max}급.`
    : ''

  return [
    `## 학습자 오류 프로필 (최근 ${profile.totalRecent}건 기준)`,
    '이 학습자가 자주 틀리는 유형입니다. 답변 시 관련 유형이 나오면 이 맥락을 활용해',
    '개인화된 설명을 하되, 질문과 무관하면 억지로 끼워 맞추지 않습니다.',
    ...lines,
    hsk
  ].join('\n').trimEnd()
}

/** 인증된 학습자의 프로필 섹션을 바로 만들어 반환(없으면 null). 라우트 편의용. */
export async function getLearnerProfileSection(studentId: string): Promise<string | null> {
  const supabase = createServerClient()
  const profile = await aggregateLearnerProfile(supabase, studentId)
  return buildLearnerProfileSection(profile)
}
