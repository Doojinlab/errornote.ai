// 맞춤 그레이디드 리딩 (Targeted Graded Reading) — gamification-spec M12 / Phase G5.
// AI 가 학습자 약점 문법을 일부러 심은 짧은 지문을 본인 HSK 레벨로 생성한다.
// "읽기 = 약점 교정". 콘텐츠가 본인 오류 프로필에서 나온다는 점이 errornote 의 해자.

import { dispatchJSON } from './ai/dispatch'

export interface GradedReadingGrammar {
  point: string
  example: string
}
export interface GradedReadingGloss {
  word: string
  pinyin: string
  ko: string
}
export interface GradedReadingQuestion {
  q: string
  answer: string
}
export interface GradedReading {
  title: string
  /** 简体字 본문(학습자 HSK 레벨에 맞춘 짧은 지문) */
  text: string
  /** 일부러 심은 약점 문법 포인트 */
  targetGrammar: GradedReadingGrammar[]
  glossary: GradedReadingGloss[]
  questions: GradedReadingQuestion[]
}

/** HSK 레벨 정규화(1~6). 범위 밖이면 가까운 값으로 클램프. */
export function clampHskLevel(level: number): number {
  if (!Number.isFinite(level)) return 3
  return Math.min(6, Math.max(1, Math.round(level)))
}

export const GRADED_READING_SYSTEM = [
  '너는 한국 대학 중국어 학습자를 위한 맞춤 읽기 자료 작가다.',
  '학습자가 자주 틀리는 문법 포인트를 *자연스럽게* 심은 짧은 简体字 지문을 만든다.',
  '원칙:',
  '- 简体字만 사용(繁體字 금지).',
  '- 지정된 HSK 레벨 어휘·문형 수준을 지킨다(너무 어렵지 않게).',
  '- 약점 문법을 본문에서 1~2회씩 자연스럽게 노출하고, target_grammar 에 그 포인트와 예문을 적는다.',
  '- 본문은 4~6문장으로 짧게. 학습 부담을 낮춘다.',
  '출력은 아래 JSON 객체 하나만. 마크다운·설명 금지:',
  '{"title":"...","text":"...","target_grammar":[{"point":"...","example":"..."}],',
  '"glossary":[{"word":"...","pinyin":"...","ko":"..."}],"questions":[{"q":"...","answer":"..."}]}'
].join('\n')

export function buildGradedReadingUserPrompt(weakGrammar: string[], hskLevel: number): string {
  const lvl = clampHskLevel(hskLevel)
  if (weakGrammar.length === 0) {
    return [
      `HSK ${lvl}급 수준의 짧은 읽기 지문을 만들어 주세요.`,
      '특정 약점이 없으니 자주 쓰는 기초 문형을 골고루 노출해 주세요.'
    ].join('\n')
  }
  return [
    `HSK ${lvl}급 수준으로, 아래 약점 문법을 자연스럽게 심은 짧은 지문을 만들어 주세요:`,
    ...weakGrammar.map((g) => `- ${g}`),
    '',
    '각 약점은 본문에 1~2회 노출하고 target_grammar 에 정리해 주세요.'
  ].join('\n')
}

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function strArr<T>(v: unknown, map: (o: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(v)) return []
  return v.map((it) => map((it ?? {}) as Record<string, unknown>))
}

export function parseGradedReading(raw: string): GradedReading {
  const obj = JSON.parse(stripFences(raw)) as Record<string, unknown>
  const title = String(obj.title ?? '').trim()
  const text = String(obj.text ?? '').trim()
  if (!text) {
    throw new Error('graded-reading 응답에 본문(text)이 없습니다')
  }
  return {
    title,
    text,
    targetGrammar: strArr(obj.target_grammar, (o) => ({
      point: String(o.point ?? '').trim(),
      example: String(o.example ?? '').trim()
    })).filter((g) => g.point),
    glossary: strArr(obj.glossary, (o) => ({
      word: String(o.word ?? '').trim(),
      pinyin: String(o.pinyin ?? '').trim(),
      ko: String(o.ko ?? '').trim()
    })).filter((g) => g.word),
    questions: strArr(obj.questions, (o) => ({
      q: String(o.q ?? '').trim(),
      answer: String(o.answer ?? '').trim()
    })).filter((q) => q.q)
  }
}

/** 약점 문법 목록 + HSK 레벨로 맞춤 지문을 생성한다. */
export async function generateGradedReading(
  weakGrammar: string[],
  hskLevel: number
): Promise<GradedReading> {
  return dispatchJSON<GradedReading>(
    'graded-reading',
    {
      system: GRADED_READING_SYSTEM,
      messages: [{ role: 'user', content: buildGradedReadingUserPrompt(weakGrammar, hskLevel) }],
      maxTokens: 1500
    },
    parseGradedReading
  )
}
