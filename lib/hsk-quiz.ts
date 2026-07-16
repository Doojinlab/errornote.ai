// 실전 HSK 다문항 세션 — 채점·완료 판정 순수 로직 (A-γ, A-7/A-8).
// UI(QuizSession)와 분리해 단위검증한다.

export interface QuizItem {
  kind: 'listening' | 'reading'
  instructions: string
  question: string
  options: string[]
  answer: string
  explanation: string
  // 듣기 전용
  audioScript?: string
  scriptPinyin?: string
  scriptTranslation?: string
  // 독해 전용
  passage?: string
}

/** MCQ 로 성립하는 문항만(보기 2개 이상 + 정답이 보기 안에). */
export function isGradableItem(it: QuizItem): boolean {
  return it.options.length >= 2 && it.options.includes(it.answer)
}

export interface QuizResult {
  total: number
  correct: number
  /** 0~100 */
  score: number
  /** 오답 문항 인덱스(0-base) */
  wrongIndexes: number[]
}

/** 답안(index→선택 보기)으로 세트를 채점한다. 미응답은 오답 처리. */
export function gradeQuiz(items: QuizItem[], answers: Record<number, string>): QuizResult {
  const total = items.length
  let correct = 0
  const wrongIndexes: number[] = []
  items.forEach((it, i) => {
    if (answers[i] !== undefined && answers[i] === it.answer) correct += 1
    else wrongIndexes.push(i)
  })
  return {
    total,
    correct,
    score: total > 0 ? Math.round((correct / total) * 100) : 0,
    wrongIndexes,
  }
}

/** 모든 문항이 응답됐는지. */
export function isComplete(items: QuizItem[], answers: Record<number, string>): boolean {
  return items.length > 0 && items.every((_, i) => answers[i] !== undefined)
}

/** 소요시간(ms)을 "M분 S초"로. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}
