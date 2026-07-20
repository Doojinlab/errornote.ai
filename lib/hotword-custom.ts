// 今日热词 "직접 입력" — 사용자가 관심 주제를 입력하면 그 주제의 요즘 표현 1개를
// 즉석 생성한다(B-1). 풀에 저장하지 않는 가벼운 경로(실재검증 게이트 없음).
// 카드 표시·발음·작문 진입에 쓸 필드만 생성한다.

import { dispatchJSON } from '@/lib/ai/dispatch'
import { extractFirstJsonObject } from '@/lib/parser'

/** 직접입력 결과 카드(풀 미저장, 표시 전용). */
export interface CustomHotword {
  term: string
  pinyin: string
  literal: string
  meaning: string
  example: string
  origin: string
  registerTag: string
}

interface RawCustom {
  term?: unknown
  pinyin?: unknown
  literal?: unknown
  meaning?: unknown
  example?: unknown
  origin?: unknown
  register_tag?: unknown
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

const SYSTEM = [
  '너는 요즘 중국에서 쓰이는 신조어·유행어를 잘 아는 원어민 친구다.',
  '사용자가 준 "관심 주제"에 어울리는 요즘 뜨는 중국어 표현 1개를 골라 카드로 설명한다.',
  '원칙:',
  '- 简体字만 사용. 실제로 쓰이는 표현을 고른다(억지 창작 금지).',
  '- 비속어·성적·정치민감 표현은 피한다.',
  '- pinyin 은 성조부호로(예: yán zhí).',
  '- example 은 그 표현이 들어간 자연스러운 짧은 예문(简体字).',
  '- register_tag 는 격식도(예: 인터넷 유행어 / 구어 / 신조어) 한국어로 짧게.',
  '출력은 아래 JSON 객체 하나만. 마크다운·설명 금지:',
  '{"term":"...","pinyin":"...","literal":"...","meaning":"...","example":"...","origin":"...","register_tag":"..."}',
].join('\n')

export function buildCustomHotwordUserPrompt(topic: string): string {
  return `관심 주제: "${topic.trim()}"\n이 주제에 맞는 요즘 중국어 표현 1개를 위 형식으로 만들어 주세요.`
}

export function parseCustomHotword(raw: string): CustomHotword {
  const jsonStr = extractFirstJsonObject(raw)
  if (!jsonStr) throw new Error('직접입력 热词 JSON 을 찾지 못했습니다')
  const obj = JSON.parse(jsonStr) as RawCustom
  const term = str(obj.term)
  const meaning = str(obj.meaning)
  if (!term) throw new Error('직접입력 热词에 표현(term)이 없습니다')
  if (!meaning) throw new Error('직접입력 热词에 뜻(meaning)이 없습니다')
  return {
    term,
    pinyin: str(obj.pinyin),
    literal: str(obj.literal),
    meaning,
    example: str(obj.example),
    origin: str(obj.origin),
    registerTag: str(obj.register_tag),
  }
}

/** 관심 주제로 요즘 표현 1개를 생성한다. */
export async function generateCustomHotword(topic: string): Promise<CustomHotword> {
  const trimmed = topic.trim()
  if (!trimmed) throw new Error('관심 주제가 비어 있습니다')
  return dispatchJSON<CustomHotword>(
    'hotword-generate',
    {
      system: SYSTEM,
      messages: [{ role: 'user', content: buildCustomHotwordUserPrompt(trimmed) }],
      maxTokens: 800,
      thinking: false,
    },
    parseCustomHotword,
  )
}
