// 병음 성조 색상 코딩 — 今日热词 카드 등에서 병음을 성조별 색으로 표시(B-2).
// 성조 판정은 lib/tone-analysis.parsePinyinTone 재사용(성조부호·숫자 모두 지원).
// 색은 기존 팔레트 토큰에 매핑해 팔레트를 지킨다: 1성 terra / 2성 gold / 3성 jade / 4성 blue / 경성 muted.

import { parsePinyinTone, type ChineseTone } from './tone-analysis'

export interface PinyinPart {
  text: string
  /** 0 = 경성/공백/미지 */
  tone: 0 | ChineseTone
}

/** 병음 문자열을 음절 토큰으로 쪼개고 각 토큰의 성조를 판정한다(공백은 tone 0 파트로 보존). */
export function pinyinToneParts(pinyin: string): PinyinPart[] {
  if (!pinyin || !pinyin.trim()) return []
  // 공백을 보존하며 분리(예: "yán zhí" → ["yán", " ", "zhí"]).
  return pinyin
    .trim()
    .split(/(\s+)/)
    .filter((t) => t.length > 0)
    .map((t) => (/^\s+$/.test(t) ? { text: t, tone: 0 as const } : { text: t, tone: parsePinyinTone(t) }))
}

/** 성조별 텍스트 색 클래스(기존 팔레트 토큰). */
export const TONE_TEXT_CLASS: Record<0 | ChineseTone, string> = {
  1: 'text-terra',
  2: 'text-gold',
  3: 'text-jade',
  4: 'text-blue',
  0: 'text-muted',
}

export function toneTextClass(tone: 0 | ChineseTone): string {
  return TONE_TEXT_CLASS[tone]
}
