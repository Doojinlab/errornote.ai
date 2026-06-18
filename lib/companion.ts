// 误 동반자 (Companion) — gamification-spec §1.1, M1/M6.
// 브랜드 마스코트(误 印章)가 학습자의 오류 여정을 함께한다.
// 진화는 "오류 유형을 졸업시킬수록"(= mastery_points) 진행된다.

export type CompanionStage = 1 | 2 | 3 | 4

/** 단계별 진입에 필요한 누적 mastery_points(졸업 점수). 인덱스 0 = 1단계. */
export const COMPANION_THRESHOLDS: ReadonlyArray<number> = [0, 3, 8, 20]

/** 단계별 마스코트 이모지(误 의 성장). UI 표시는 i18n 타이틀과 함께 쓴다. */
export const COMPANION_EMOJI: Readonly<Record<CompanionStage, string>> = {
  1: '🥚',
  2: '🐣',
  3: '🦉',
  4: '🐲'
}

/** mastery_points 로 현재 동반자 진화 단계를 계산한다. */
export function companionStage(masteryPoints: number): CompanionStage {
  const mp = Number.isFinite(masteryPoints) ? masteryPoints : 0
  let stage: CompanionStage = 1
  for (let i = 1; i < COMPANION_THRESHOLDS.length; i++) {
    if (mp >= COMPANION_THRESHOLDS[i]) stage = (i + 1) as CompanionStage
  }
  return stage
}

/** 다음 단계 진입에 필요한 누적 mastery_points. 최종 단계면 null. */
export function nextStageThreshold(stage: CompanionStage): number | null {
  return stage < COMPANION_THRESHOLDS.length ? COMPANION_THRESHOLDS[stage] : null
}

/** 단계에 대응하는 이모지. */
export function companionEmoji(stage: CompanionStage): string {
  return COMPANION_EMOJI[stage]
}
