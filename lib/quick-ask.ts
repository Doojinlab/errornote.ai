// "이거 자연스러워?" 퀵애스크 (Naturalness Q&A) — gamification-spec M10 / Phase G5.
// HiNative/Busuu 교정 모델의 errornote 판. 낯선 원어민 대신 AI 즉답 + (선택적) 교수 확인.
// 위축감 주는 톤 금지, 협업 프레이밍("같이 다듬어 봐요").

import { dispatchJSON } from './ai/dispatch'

export type NaturalnessVerdict = 'natural' | 'awkward' | 'incorrect'

export interface NaturalnessResult {
  /** 0~100 자연스러움 점수 */
  score: number
  verdict: NaturalnessVerdict
  /** 더 자연스러운 표현(없으면 원문과 동일하거나 빈 문자열) */
  suggestion: string
  /** 짧고 따뜻한 설명 */
  note: string
}

export const NATURALNESS_SYSTEM = [
  '너는 한국 중국어 학습자의 다정한 원어민 친구다.',
  '학습자가 쓴 중국어 문장이 자연스러운지 즉답한다.',
  '원칙:',
  '- 위축감 주지 말고 협업 톤("같이 다듬어 봐요").',
  '- 简体字만 사용.',
  '- 틀리지 않았어도 더 자연스러운 표현이 있으면 제안한다.',
  '- score: 0~100(자연스러움). verdict: natural|awkward|incorrect.',
  '출력은 아래 JSON 객체 하나만. 마크다운·설명 금지:',
  '{"score":0,"verdict":"natural|awkward|incorrect","suggestion":"...","note":"..."}'
].join('\n')

export function buildNaturalnessUserPrompt(text: string): string {
  return [
    '이 중국어 문장이 자연스러운지 봐 주세요:',
    `"${text.trim()}"`
  ].join('\n')
}

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function normVerdict(v: unknown): NaturalnessVerdict {
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'incorrect' || s === 'awkward' ? s : 'natural'
}

function clampScore(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function parseNaturalness(raw: string): NaturalnessResult {
  const obj = JSON.parse(stripFences(raw)) as Record<string, unknown>
  return {
    score: clampScore(obj.score),
    verdict: normVerdict(obj.verdict),
    suggestion: String(obj.suggestion ?? '').trim(),
    note: String(obj.note ?? '').trim()
  }
}

/** 문장의 자연스러움을 AI 가 즉답한다. */
export async function askNaturalness(text: string): Promise<NaturalnessResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('askNaturalness: 빈 문장입니다')
  }
  return dispatchJSON<NaturalnessResult>(
    'naturalness-check',
    {
      system: NATURALNESS_SYSTEM,
      messages: [{ role: 'user', content: buildNaturalnessUserPrompt(trimmed) }],
      maxTokens: 600
    },
    parseNaturalness
  )
}
