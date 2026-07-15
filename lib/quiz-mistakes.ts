// 튜터 연습 퀴즈 오답 저장/조회. AI 과외 채팅의 연습 퀴즈(클라이언트 전용)에서
// 학습자가 틀린 문항을 스냅샷으로 남겨, 날짜별 "오답 노트" 라이브러리로 열람한다.
// 저장은 API 라우트(/api/quiz-mistakes)에서, 조회는 라이브러리 페이지에서 사용한다.
import { createServerClient } from './supabase'
import { getAuthContext } from './auth'

/** 클라이언트가 오답 발생 시 전송하는 문항 스냅샷. */
export interface QuizMistakeInput {
  topic: string | null
  prompt: string
  options: string[]
  chosenIndex: number
  answerIndex: number
  explanation?: string | null
  chapterNumber?: number | null
}

/** 라이브러리 렌더용 오답 레코드(1건). */
export interface QuizMistake {
  id: string
  topic: string | null
  prompt: string
  options: string[]
  chosenIndex: number
  answerIndex: number
  explanation: string | null
  chapterNumber: number | null
  createdAt: string
}

const MAX_OPTIONS = 12
const MAX_TEXT = 2000

/** 입력을 검증·정규화한다. 유효하지 않거나 정답을 맞힌 경우(오답 아님) null. */
export function normalizeQuizMistake(raw: unknown): QuizMistakeInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const prompt = typeof o.prompt === 'string' ? o.prompt.trim() : ''
  if (!prompt || prompt.length > MAX_TEXT) return null

  if (!Array.isArray(o.options)) return null
  const options = o.options
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.slice(0, MAX_TEXT))
  if (options.length < 2 || options.length > MAX_OPTIONS) return null

  const chosenIndex = Number(o.chosenIndex)
  const answerIndex = Number(o.answerIndex)
  if (!Number.isInteger(chosenIndex) || !Number.isInteger(answerIndex)) return null
  if (chosenIndex < 0 || chosenIndex >= options.length) return null
  if (answerIndex < 0 || answerIndex >= options.length) return null
  // 오답만 기록한다(정답을 맞힌 문항은 노트에 남기지 않는다).
  if (chosenIndex === answerIndex) return null

  const topic = typeof o.topic === 'string' && o.topic.trim() ? o.topic.trim().slice(0, MAX_TEXT) : null
  const explanation =
    typeof o.explanation === 'string' && o.explanation.trim()
      ? o.explanation.trim().slice(0, MAX_TEXT)
      : null
  const chapterNumber =
    typeof o.chapterNumber === 'number' && Number.isFinite(o.chapterNumber) ? o.chapterNumber : null

  return { topic, prompt, options, chosenIndex, answerIndex, explanation, chapterNumber }
}

/** 오답 1건 저장(학생 본인 RLS). 성공 여부 반환. */
export async function recordQuizMistake(studentId: string, input: QuizMistakeInput): Promise<boolean> {
  const supabase = createServerClient()
  const { error } = await supabase.from('quiz_mistakes').insert({
    student_id: studentId,
    topic: input.topic,
    prompt: input.prompt,
    options: input.options,
    chosen_index: input.chosenIndex,
    answer_index: input.answerIndex,
    explanation: input.explanation ?? null,
    chapter_number: input.chapterNumber ?? null,
  })
  if (error) {
    console.error('[quiz-mistakes recordQuizMistake]', error)
    return false
  }
  return true
}

interface QuizMistakeRow {
  id: string
  topic: string | null
  prompt: string
  options: unknown
  chosen_index: number
  answer_index: number
  explanation: string | null
  chapter_number: number | null
  created_at: string
}

/** 현재 학생의 오답을 최신순으로 조회. 라이브러리 페이지에서 날짜별로 그룹핑한다. */
export async function loadQuizMistakes(limit = 300): Promise<QuizMistake[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('quiz_mistakes')
    .select('id, topic, prompt, options, chosen_index, answer_index, explanation, chapter_number, created_at')
    .eq('student_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[quiz-mistakes loadQuizMistakes]', error)
    return []
  }

  return ((data as QuizMistakeRow[] | null) ?? []).map((r) => ({
    id: r.id,
    topic: r.topic,
    prompt: r.prompt,
    options: Array.isArray(r.options) ? (r.options as string[]) : [],
    chosenIndex: r.chosen_index,
    answerIndex: r.answer_index,
    explanation: r.explanation,
    chapterNumber: r.chapter_number,
    createdAt: r.created_at,
  }))
}
