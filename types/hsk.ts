// 실전 HSK 기능 전용 타입 (docs/dashboard-features.md §1).
// 저작권상 실제 기출 원문이 아니라 "기출 유형을 학습한 AI 생성 문제"만 다룬다.

import type { HskArea, HskLevel, HskMode } from '@/types'

/** 생성된 HSK 문제 스냅샷 — hsk_generated_questions.question(jsonb)에 그대로 저장. */
export interface HskQuestion {
  level: HskLevel
  area: HskArea
  mode: HskMode
  /** 문제 유형(유형별 템플릿 키). 예: '독해-지문이해', '쓰기-어순배열', '쓰기-작문', '개념'. */
  type: string
  /** 학습자에게 보여줄 한국어 지시문. */
  instructions: string
  /** 독해 지문 또는 작문 자료(중국어). 없을 수 있음. */
  passage?: string
  /** 문제 본문(중국어 또는 혼합). */
  prompt: string
  /** 객관식 보기(있으면). */
  options?: string[]
  /** 정답 — 객관식이면 정답 보기, 작문이면 모범답안/채점 포인트. */
  answer?: string
  /** 해설(한국어). */
  explanation?: string
}

export interface HskGenerateRequest {
  level: HskLevel
  area: HskArea
  mode: HskMode
}

export interface HskGenerateResponse {
  question: HskQuestion
  /** hsk_generated_questions 로그 PK(영속화 성공 시). */
  logId?: string
}

/**
 * HSK 듣기(听力) 문제 — AI 가 대본을 생성하고 ElevenLabs TTS 로 음성을 들려준다.
 * 저작권상 실제 기출 음성/원문이 아니라 "기출 유형" 기반 AI 생성 대본만 다룬다.
 */
export interface HskListeningQuestion {
  level: HskLevel
  /** 들려줄 중국어 대본(简体字). TTS 로 재생하며 정답 전까지 화면에는 숨긴다. */
  audioScript: string
  /** 학습자에게 보여줄 한국어 지시문. */
  instructions: string
  /** 문제 본문(한국어). */
  question: string
  /** 4지선다 보기(중국어 또는 한국어). */
  options: string[]
  /** 정답 — options 중 하나와 정확히 일치. */
  answer: string
  /** 해설(한국어). */
  explanation: string
}

export interface HskListeningGenerateResponse {
  question: HskListeningQuestion
}
