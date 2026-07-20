// 실전 HSK — 문제 생성 + 로그 영속화 (docs/dashboard-features.md §1, §3)
//
// generateHskQuestion : 기출 유형 학습 기반으로 구조화된 문제 1개 생성(dispatchJSON).
// logHskQuestion      : 생성 문제를 hsk_generated_questions 에 스냅샷 저장(학생 본인 RLS).
//
// ⚠️ 저작권: 실제 기출 원문 저장 금지 — "유형" 기반 생성 문제만 다룬다.

import { dispatchJSON } from '@/lib/ai/dispatch'
import { extractFirstJsonObject } from '@/lib/parser'
import { createServerClient } from '@/lib/supabase'
import {
  buildHskGenerationSystem,
  buildHskGenerationUserPrompt,
} from '@/lib/prompts/hsk'
import type { HskArea, HskLevel, HskMode } from '@/types'
import type { HskQuestion } from '@/types/hsk'
import type { Json } from '@/types/database'

interface RawHskQuestion {
  type?: unknown
  instructions?: unknown
  passage?: unknown
  prompt?: unknown
  options?: unknown
  answer?: unknown
  explanation?: unknown
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function parseHskQuestion(
  raw: string,
  level: HskLevel,
  area: HskArea,
  mode: HskMode,
): HskQuestion {
  const jsonStr = extractFirstJsonObject(raw)
  if (!jsonStr) throw new Error('HSK 문제 JSON 을 찾지 못했습니다')
  const obj = JSON.parse(jsonStr) as RawHskQuestion

  const prompt = str(obj.prompt)
  const instructions = str(obj.instructions)
  if (!prompt || !instructions) {
    throw new Error('HSK 문제에 instructions/prompt 가 없습니다')
  }

  const options = Array.isArray(obj.options)
    ? obj.options.map((o) => String(o)).filter((o) => o.trim())
    : undefined

  return {
    level,
    area,
    mode,
    type: str(obj.type) ?? '기타',
    instructions,
    passage: str(obj.passage),
    prompt,
    options: options && options.length > 0 ? options : undefined,
    answer: str(obj.answer),
    explanation: str(obj.explanation),
  }
}

/** 기출 유형 기반 HSK 문제 1개 생성. */
export async function generateHskQuestion(
  level: HskLevel,
  area: HskArea,
  mode: HskMode,
): Promise<HskQuestion> {
  const system = buildHskGenerationSystem(level, area, mode)
  return dispatchJSON<HskQuestion>(
    'hsk-generate',
    {
      system,
      messages: [{ role: 'user', content: buildHskGenerationUserPrompt(level, area) }],
      maxTokens: 2000,
      thinking: false,
    },
    (raw) => parseHskQuestion(raw, level, area, mode),
  )
}

/** 생성 문제를 학생 본인 로그에 스냅샷 저장. 실패해도 학습 흐름을 막지 않는다. */
export async function logHskQuestion(
  studentId: string,
  question: HskQuestion,
): Promise<string | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('hsk_generated_questions')
    .insert({
      student_id: studentId,
      level: question.level,
      // 듣기·말하기는 이 경로로 생성되지 않는다(독해·쓰기 전용). DB 컬럼 유니온에 맞춰 좁힌다.
      area: question.area as 'reading' | 'writing' | 'speaking',
      mode: question.mode,
      question: question as unknown as Json,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[hsk] 문제 로그 저장 실패:', error)
    return null
  }
  return data?.id ?? null
}
