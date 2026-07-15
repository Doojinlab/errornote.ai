// 今日热词 기능 전용 타입 (docs/dashboard-features.md §2).
// cardnews 처럼 공유 types/index.ts 와 분리해 기존 주간 카드뉴스와 섞이지 않게 둔다.

export type HotwordCategory =
  | 'game'
  | 'entertainment'
  | 'society'
  | 'economy'
  | 'daily'
  | 'meme'

export type HotwordStatus = 'active' | 'dormant'

export type HotwordVote = 'like' | 'dislike'

/** 수집 출처 근거 — 실재검증 게이트①(서로 다른 2곳↑) 저장용. */
export interface HotwordSource {
  name: string
  url?: string
  date?: string
}

/** 대시보드 카드/워크스페이스 제시에 쓰는 뷰 모델(§2.3 카드 필드). */
export interface Hotword {
  id: string
  term: string
  category: HotwordCategory
  pinyin: string | null
  literal: string | null
  meaning: string | null
  example: string | null
  origin: string | null
  registerTag: string | null
  sources: HotwordSource[]
  firstSeen: string
  status: HotwordStatus
  exposureUntil: string | null
  impressions: number
  likes: number
  dislikes: number
}

/** 파이프라인 1단계 산출 — 웹 검색으로 수집한 후보(해설 생성 전). */
export interface HotwordCandidate {
  term: string
  category: HotwordCategory
  sources: HotwordSource[]
}

/** 파이프라인 실행 요약 — cron/관리 응답용. */
export interface HotwordPipelineResult {
  collected: number
  passedExistence: number
  explained: number
  passedSafety: number
  published: number
  skippedDuplicate: number
}

/** 피드백 기록 결과 — 큐레이션 판정과 함께 클라이언트에 돌려준다. */
export interface HotwordVoteResult {
  vote: HotwordVote
  likes: number
  dislikes: number
  /** 비율 판정으로 동면 처리됐는지(§2.5). */
  dormant: boolean
}
