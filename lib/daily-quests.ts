// 데일리 퀘스트 생성 — gamification-spec §1.2(닫힘 루프), §3, §5 Phase G2.
// "어제의 오류 → AI 가 오늘의 2분 미션 3개 생성." 닫힘 루프의 생성 절반.

import { createServerClient, createAdminClient } from './supabase'
import { dispatchJSON } from './ai/dispatch'
import type {
  DailyQuest,
  DailyQuestMission,
  DailyQuestSource,
  DailyQuestSourceItem
} from '@/types/daily-quests'
import type { Json } from '@/types/database'

export const MISSION_COUNT = 3
/** 미션 근거로 삼을 어제 오류 상위 유형 수. */
export const SOURCE_TOP_N = 3

// ── 날짜 유틸 (UTC YYYY-MM-DD) ────────────────────────────────────────────────

export function ymd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** todayYmd 의 전날(YYYY-MM-DD). */
export function previousYmd(todayYmd: string): string {
  const d = new Date(`${todayYmd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return ymd(d)
}

// ── 1) 어제 오류 집계 ─────────────────────────────────────────────────────────

type Sb = ReturnType<typeof createServerClient>

/** 어제(=todayYmd 전날) 학습자의 error_cards 를 subtype 별로 집계해 상위 N개 반환. */
export async function aggregateYesterdayErrors(
  supabase: Sb,
  studentId: string,
  todayYmd: string
): Promise<DailyQuestSource> {
  const yesterday = previousYmd(todayYmd)
  const { data, error } = await supabase
    .from('error_cards')
    .select('error_subtype')
    .eq('student_id', studentId)
    .gte('created_at', `${yesterday}T00:00:00Z`)
    .lt('created_at', `${todayYmd}T00:00:00Z`)
  if (error) {
    throw new Error(`error_cards 조회 실패: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{ error_subtype: string | null }>
  const counts = new Map<string, number>()
  for (const r of rows) {
    const label = (r.error_subtype ?? '').trim()
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const top: DailyQuestSourceItem[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SOURCE_TOP_N)
    .map(([label, count]) => ({ code: null, label, count }))

  return { top, total_errors: rows.length }
}

// ── 2) 프롬프트 (순수) ────────────────────────────────────────────────────────

export const DAILY_QUEST_SYSTEM = [
  '너는 한국 대학 중국어 학습자의 학습 동반자 "误"다.',
  '학습자의 어제 오류 프로필을 받아, 오늘 할 2분짜리 미션 3개를 생성한다.',
  '원칙:',
  '- 무벌점(no-shame): 오류를 탓하지 말고 격려하는 따뜻한 톤.',
  '- 각 미션은 구체적이고 2분 내 완료 가능해야 한다.',
  '- 가능하면 어제 오류 유형(subtype)에 직접 연결하고, source_label 에 그 유형명을 넣는다.',
  '- 어제 오류가 없으면 가벼운 복습/작문 미션을 제안한다(여전히 따뜻하게).',
  '출력은 아래 JSON 객체 하나만. 마크다운·설명 금지:',
  '{"missions":[{"title":"...","instruction":"...","source_label":"유형명 또는 null"}]}',
  `missions 는 정확히 ${MISSION_COUNT}개.`
].join('\n')

export function buildDailyQuestUserPrompt(source: DailyQuestSource): string {
  if (source.top.length === 0) {
    return [
      '어제 기록된 오류가 없어요.',
      '가볍게 다시 시작할 수 있는 따뜻한 미션 3개를 만들어 주세요.'
    ].join('\n')
  }
  const lines = source.top.map(
    (t) => `- ${t.label} (${t.count}회)`
  )
  return [
    `어제 총 ${source.total_errors}개의 오류가 있었어요. 자주 나온 유형:`,
    ...lines,
    '',
    `이 유형들을 복습할 2분 미션 ${MISSION_COUNT}개를 만들어 주세요. 각 미션의 source_label 에 대응 유형명을 넣어주세요.`
  ].join('\n')
}

// ── 3) 파싱 (순수) ────────────────────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function parseDailyQuests(raw: string): DailyQuestMission[] {
  const obj = JSON.parse(stripFences(raw)) as { missions?: unknown }
  const arr = Array.isArray(obj?.missions) ? obj.missions : null
  if (!arr) {
    throw new Error('daily-quest 응답에 missions 배열이 없습니다')
  }
  const missions: DailyQuestMission[] = arr
    .slice(0, MISSION_COUNT)
    .map((raw_m, i) => {
      const m = (raw_m ?? {}) as Record<string, unknown>
      const sl = m.source_label
      return {
        id: `m${i + 1}`,
        title: String(m.title ?? '').trim(),
        instruction: String(m.instruction ?? '').trim(),
        source_code: null,
        source_label: sl == null || sl === '' ? null : String(sl).trim(),
        done: false
      }
    })
    .filter((m) => m.title && m.instruction)
  if (missions.length === 0) {
    throw new Error('daily-quest 응답에 유효한 미션이 없습니다')
  }
  return missions
}

// ── 4) 생성 ───────────────────────────────────────────────────────────────────

export async function generateDailyQuestMissions(
  source: DailyQuestSource
): Promise<DailyQuestMission[]> {
  return dispatchJSON<DailyQuestMission[]>(
    'daily-quest',
    {
      system: DAILY_QUEST_SYSTEM,
      messages: [{ role: 'user', content: buildDailyQuestUserPrompt(source) }],
      maxTokens: 2000
    },
    parseDailyQuests
  )
}

// ── 5) getOrCreate (오케스트레이터) ──────────────────────────────────────────

function rowToQuest(row: {
  id: string
  student_id: string
  quest_date: string
  source: Json
  missions: Json
  created_at: string
}): DailyQuest {
  return {
    id: row.id,
    student_id: row.student_id,
    quest_date: row.quest_date,
    source: (row.source ?? { top: [], total_errors: 0 }) as unknown as DailyQuestSource,
    missions: (row.missions ?? []) as unknown as DailyQuestMission[],
    created_at: row.created_at
  }
}

/**
 * 오늘자 퀘스트를 반환한다. 없으면 어제 오류로 생성해 insert(서버 전용) 후 반환.
 * RLS: 읽기는 본인 클라이언트, insert 는 service-role(admin) — 생성 경로는 서버.
 */
export async function getOrCreateTodayQuest(studentId: string): Promise<DailyQuest> {
  const supabase = createServerClient()
  const today = ymd(new Date())

  const { data: existing, error: readErr } = await supabase
    .from('daily_quests')
    .select('id, student_id, quest_date, source, missions, created_at')
    .eq('student_id', studentId)
    .eq('quest_date', today)
    .maybeSingle()
  if (readErr) {
    throw new Error(`daily_quests 조회 실패: ${readErr.message}`)
  }
  if (existing) {
    return rowToQuest(existing as Parameters<typeof rowToQuest>[0])
  }

  const source = await aggregateYesterdayErrors(supabase, studentId, today)
  const missions = await generateDailyQuestMissions(source)

  const admin = createAdminClient()
  const { data: inserted, error: insErr } = await admin
    .from('daily_quests')
    .insert({
      student_id: studentId,
      quest_date: today,
      source: source as unknown as Json,
      missions: missions as unknown as Json
    } as never)
    .select('id, student_id, quest_date, source, missions, created_at')
    .single()
  if (insErr || !inserted) {
    throw new Error(`daily_quests 생성 실패: ${insErr?.message ?? 'no row'}`)
  }
  return rowToQuest(inserted as Parameters<typeof rowToQuest>[0])
}
