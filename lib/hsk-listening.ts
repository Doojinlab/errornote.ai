// 실전 HSK 듣기(听力) — AI 대본 생성 (docs/dashboard-features.md §1 확장).
// generateHskListening : 기출 유형 기반 듣기 문제 1개 생성(dispatchJSON).
// 대본(audioScript)은 ElevenLabs TTS 로 재생한다(app/api/hsk/tts).
//
// ⚠️ 저작권: 실제 기출 원문 저장 금지 — "유형" 기반 생성 문제만 다룬다.

import { dispatchJSON } from '@/lib/ai/dispatch'
import { extractFirstJsonObject } from '@/lib/parser'
import {
  buildHskListeningSystem,
  buildHskListeningUserPrompt,
} from '@/lib/prompts/hsk-listening'
import type { HskLevel } from '@/types'
import type { HskListeningQuestion } from '@/types/hsk'

interface RawListening {
  audio_script?: unknown
  script_pinyin?: unknown
  script_translation?: unknown
  instructions?: unknown
  question?: unknown
  options?: unknown
  answer?: unknown
  explanation?: unknown
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function parseHskListening(raw: string, level: HskLevel): HskListeningQuestion {
  const jsonStr = extractFirstJsonObject(raw)
  if (!jsonStr) throw new Error('HSK 듣기 문제 JSON 을 찾지 못했습니다')
  const obj = JSON.parse(jsonStr) as RawListening

  const audioScript = str(obj.audio_script)
  const instructions = str(obj.instructions)
  const question = str(obj.question)
  const answer = str(obj.answer)
  const options = Array.isArray(obj.options)
    ? obj.options.map((o) => String(o).trim()).filter(Boolean)
    : []

  if (!audioScript) throw new Error('HSK 듣기 문제에 대본(audio_script)이 없습니다')
  if (!question) throw new Error('HSK 듣기 문제에 질문(question)이 없습니다')
  if (options.length < 2) throw new Error('HSK 듣기 문제에 보기(options)가 부족합니다')
  if (!answer || !options.includes(answer)) {
    throw new Error('HSK 듣기 정답(answer)이 보기(options)와 일치하지 않습니다')
  }

  return {
    level,
    audioScript,
    scriptPinyin: str(obj.script_pinyin),
    scriptTranslation: str(obj.script_translation),
    instructions: instructions ?? '녹음을 듣고 알맞은 답을 고르세요.',
    question,
    options,
    answer,
    explanation: str(obj.explanation) ?? '',
  }
}

/** 기출 유형 기반 HSK 듣기 문제 1개 생성. */
export async function generateHskListening(level: HskLevel): Promise<HskListeningQuestion> {
  return dispatchJSON<HskListeningQuestion>(
    'hsk-generate',
    {
      system: buildHskListeningSystem(level),
      messages: [{ role: 'user', content: buildHskListeningUserPrompt(level) }],
      maxTokens: 2000,
      thinking: false,
    },
    (raw) => parseHskListening(raw, level),
  )
}
