// 실전 HSK — 급수·영역·모드 상수 및 라벨 (docs/dashboard-features.md §1)
//
// 대시보드 입장 카드(칩)와 워크스페이스 입장 파라미터 파싱이 같은 정의를 공유하도록
// 한곳에 모은다. 저작권상 실제 기출 원문은 다루지 않고 "기출 유형"만 코드로 남긴다.

import type {
  HskArea,
  HskGradingMode,
  HskLevel,
  HskMode,
  HskSessionType,
} from '@/types'

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
  { value: 'listening', label: '듣기' }, // A-3 신규
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
  listening: '듣기',
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
  return v === 'listening' || v === 'reading' || v === 'writing' || v === 'speaking'
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

// ── 문제 풀이 세부: 연습/실전 · 채점 타이밍 (A-3) ────────────────────────────

export interface HskSessionTypeMeta {
  value: HskSessionType
  label: string
  desc: string
}
export const HSK_SESSION_TYPES: readonly HskSessionTypeMeta[] = [
  { value: 'drill', label: '연습 모드', desc: '제한시간 없이 편하게' },
  { value: 'exam', label: '실전 모드', desc: '제한시간·자동제출' },
] as const

export interface HskGradingModeMeta {
  value: HskGradingMode
  label: string
  desc: string
}
export const HSK_GRADING_MODES: readonly HskGradingModeMeta[] = [
  { value: 'immediate', label: '즉시 채점', desc: '문항마다 바로 정답' },
  { value: 'batch', label: '모아서 채점', desc: '다 풀고 성적표' },
] as const

const SESSION_TYPE_LABEL: Record<HskSessionType, string> = {
  drill: '연습',
  exam: '실전',
}
const GRADING_MODE_LABEL: Record<HskGradingMode, string> = {
  immediate: '즉시 채점',
  batch: '모아서 채점',
}

export function hskSessionTypeLabel(v: HskSessionType): string {
  return SESSION_TYPE_LABEL[v]
}
export function hskGradingModeLabel(v: HskGradingMode): string {
  return GRADING_MODE_LABEL[v]
}
export function isHskSessionType(v: unknown): v is HskSessionType {
  return v === 'drill' || v === 'exam'
}
export function isHskGradingMode(v: unknown): v is HskGradingMode {
  return v === 'immediate' || v === 'batch'
}

export interface HskSessionParams {
  level: HskLevel
  area: HskArea
  mode: HskMode
  sessionType?: HskSessionType
  gradingMode?: HskGradingMode
}

/**
 * /hsk/session 진입 쿼리를 안전한 세션 파라미터로 파싱(A-α). 유효하지 않으면 null.
 * 규칙: 말하기 차단. mode='practice' 면 sessionType 필수(기본 drill).
 * 실전(exam)은 채점을 batch 로 강제(A-5). 연습(drill)은 gradingMode 기본 immediate.
 */
export function parseHskSessionParams(params: {
  level?: string
  area?: string
  hskMode?: string
  sessionType?: string
  gradingMode?: string
}): HskSessionParams | null {
  const level = Number(params.level)
  const area = params.area
  const mode = params.hskMode
  if (!isHskLevel(level) || !isHskArea(area) || !isHskMode(mode)) return null
  if (area === 'speaking') return null

  if (mode === 'concept') {
    return { level, area, mode }
  }

  // 문제 풀이: 연습/실전
  const sessionType: HskSessionType = isHskSessionType(params.sessionType)
    ? params.sessionType
    : 'drill'
  if (sessionType === 'exam') {
    // 실전은 채점을 항상 모아서(A-5).
    return { level, area, mode, sessionType, gradingMode: 'batch' }
  }
  const gradingMode: HskGradingMode = isHskGradingMode(params.gradingMode)
    ? params.gradingMode
    : 'immediate'
  return { level, area, mode, sessionType, gradingMode }
}
