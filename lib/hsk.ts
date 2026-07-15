// 실전 HSK — 급수·영역·모드 상수 및 라벨 (docs/dashboard-features.md §1)
//
// 대시보드 입장 카드(칩)와 워크스페이스 입장 파라미터 파싱이 같은 정의를 공유하도록
// 한곳에 모은다. 저작권상 실제 기출 원문은 다루지 않고 "기출 유형"만 코드로 남긴다.

import type { HskArea, HskLevel, HskMode } from '@/types'

export const HSK_LEVELS: readonly HskLevel[] = [3, 4, 5, 6] as const

export interface HskAreaMeta {
  value: HskArea
  label: string
  /** 곧 출시(비활성) — 말하기. 클릭 시 출시 알림 신청. */
  disabled?: boolean
  /** 교정 엔진 강점 — 기본 강조. */
  emphasized?: boolean
}

export const HSK_AREAS: readonly HskAreaMeta[] = [
  { value: 'reading', label: '독해' },
  { value: 'writing', label: '쓰기', emphasized: true }, // 킬러 영역
  { value: 'speaking', label: '말하기', disabled: true },
] as const

export interface HskModeMeta {
  value: HskMode
  label: string
  desc: string
}

export const HSK_MODES: readonly HskModeMeta[] = [
  { value: 'practice', label: '문제 풀이', desc: '실전처럼 계속 풀기' },
  { value: 'concept', label: '개념 학습', desc: '틀린 유형을 이론과 함께' },
] as const

const AREA_LABEL: Record<HskArea, string> = {
  reading: '독해',
  writing: '쓰기',
  speaking: '말하기',
}

const MODE_LABEL: Record<HskMode, string> = {
  practice: '문제 풀이',
  concept: '개념 학습',
}

export function hskAreaLabel(area: HskArea): string {
  return AREA_LABEL[area]
}

export function hskModeLabel(mode: HskMode): string {
  return MODE_LABEL[mode]
}

export function isHskLevel(v: unknown): v is HskLevel {
  return typeof v === 'number' && (HSK_LEVELS as readonly number[]).includes(v)
}

export function isHskArea(v: unknown): v is HskArea {
  return v === 'reading' || v === 'writing' || v === 'speaking'
}

export function isHskMode(v: unknown): v is HskMode {
  return v === 'practice' || v === 'concept'
}

/** URL 쿼리스트링(문자열)을 안전한 HskEntryContext 로 파싱. 유효하지 않으면 null. */
export function parseHskEntryParams(params: {
  level?: string
  area?: string
  hskMode?: string
}): { level: HskLevel; area: HskArea; mode: HskMode } | null {
  const level = Number(params.level)
  const area = params.area
  const mode = params.hskMode
  if (!isHskLevel(level) || !isHskArea(area) || !isHskMode(mode)) return null
  // 말하기는 아직 비활성 — 진입 차단.
  if (area === 'speaking') return null
  return { level, area, mode }
}
