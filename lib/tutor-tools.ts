// AI 튜터 Tool use (#48) — 튜터가 대화 중 호출할 수 있는 도구.
//
// 두 도구를 제공한다:
//   - add_to_vocab : 익혀야 할 단어/표현을 학습자 단어장(vocabulary)에 저장(부수효과: DB insert)
//   - generate_quiz: 약점 유형 연습용 짧은 객관식 퀴즈를 정규화해 반환(순수)
//
// 본 모듈은 도구 정의 + 입력 검증 + 핸들러 + 디스패처까지를 자족적으로 제공한다.
// 스트리밍 챗(app/api/chat, lib/claude streamText)에 tool_use 루프로 통합하는 작업은
// 실제 API 런타임 검증이 필요하므로 후속으로 둔다(docs/decisions/ai-tutor-roadmap.md 참조).

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<Database, any, any, any>

// ── 도구 정의 (Anthropic tool schema) ────────────────────────────────────────
export const TUTOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_to_vocab',
    description:
      '학습자가 익혀두면 좋은 중국어 단어/표현을 학습자 단어장에 저장한다. ' +
      '대화 중 학습자가 모르거나 자주 틀리는 핵심 단어가 나오면 호출한다.',
    input_schema: {
      type: 'object',
      properties: {
        chinese: { type: 'string', description: '저장할 중국어 단어/표현(간체)' },
        pinyin: { type: 'string', description: '병음(선택)' },
        korean: { type: 'string', description: '한국어 뜻(선택)' },
      },
      required: ['chinese'],
    },
  },
  {
    name: 'generate_quiz',
    description:
      '학습자의 약점 유형을 연습할 짧은 객관식 퀴즈를 만든다. 각 문항은 보기 2개 이상과 ' +
      '정답 인덱스를 포함한다. 학습자가 연습을 원하거나 반복 오류가 보일 때 호출한다.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: '퀴즈 주제/오류 유형(예: 把자문 어순)' },
        questions: {
          type: 'array',
          description: '문항 목록(최대 10개)',
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: '문제 지문' },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: '보기(2개 이상)',
              },
              answer_index: { type: 'integer', description: '정답 보기의 0-based 인덱스' },
              explanation: { type: 'string', description: '해설(선택)' },
            },
            required: ['prompt', 'options', 'answer_index'],
          },
        },
      },
      required: ['questions'],
    },
  },
]

export const TUTOR_TOOL_NAMES = ['add_to_vocab', 'generate_quiz'] as const
export type TutorToolName = (typeof TUTOR_TOOL_NAMES)[number]

// ── 입력 검증(순수) ──────────────────────────────────────────────────────────
export interface AddToVocabInput {
  chinese: string
  pinyin?: string
  korean?: string
}

const MAX_CHINESE = 100
const MAX_TEXT = 200

export function validateAddToVocab(raw: unknown): AddToVocabInput {
  const o = (raw ?? {}) as Record<string, unknown>
  const chinese = typeof o.chinese === 'string' ? o.chinese.trim() : ''
  if (!chinese) throw new Error('add_to_vocab: chinese(중국어)가 필요합니다')
  const pinyin =
    typeof o.pinyin === 'string' && o.pinyin.trim()
      ? o.pinyin.trim().slice(0, MAX_TEXT)
      : undefined
  const korean =
    typeof o.korean === 'string' && o.korean.trim()
      ? o.korean.trim().slice(0, MAX_TEXT)
      : undefined
  return { chinese: chinese.slice(0, MAX_CHINESE), pinyin, korean }
}

export interface QuizQuestion {
  prompt: string
  options: string[]
  answerIndex: number
  explanation?: string
}

export interface TutorQuiz {
  topic: string | null
  questions: QuizQuestion[]
}

export const MAX_QUIZ_QUESTIONS = 10

export function validateGenerateQuiz(raw: unknown): TutorQuiz {
  const o = (raw ?? {}) as Record<string, unknown>
  const topic =
    typeof o.topic === 'string' && o.topic.trim() ? o.topic.trim().slice(0, MAX_CHINESE) : null
  const rawQs = Array.isArray(o.questions) ? o.questions : []
  const questions: QuizQuestion[] = []
  for (const q of rawQs) {
    const qq = (q ?? {}) as Record<string, unknown>
    const prompt = typeof qq.prompt === 'string' ? qq.prompt.trim() : ''
    const options = Array.isArray(qq.options)
      ? qq.options
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((s) => s.trim())
      : []
    const answerIndex = Number.isInteger(qq.answer_index) ? (qq.answer_index as number) : -1
    if (!prompt || options.length < 2) continue
    if (answerIndex < 0 || answerIndex >= options.length) continue
    const explanation =
      typeof qq.explanation === 'string' && qq.explanation.trim()
        ? qq.explanation.trim()
        : undefined
    questions.push({ prompt, options, answerIndex, explanation })
    if (questions.length >= MAX_QUIZ_QUESTIONS) break
  }
  if (questions.length === 0) throw new Error('generate_quiz: 유효한 문항이 없습니다')
  return { topic, questions }
}

// ── 핸들러 ────────────────────────────────────────────────────────────────────
export interface TutorToolContext {
  supabase: SB
  studentId: string
}

export interface TutorToolResult {
  /** 모델에 돌려줄 tool_result 텍스트 */
  content: string
  /** 라우트가 클라이언트로 전달할 구조화 데이터(있을 때) */
  data?: unknown
  isError?: boolean
}

/** add_to_vocab: 검증된 단어를 학습자 단어장에 저장. */
export async function handleAddToVocab(
  input: AddToVocabInput,
  ctx: TutorToolContext
): Promise<TutorToolResult> {
  const { error } = await ctx.supabase.from('vocabulary').insert({
    student_id: ctx.studentId,
    chinese: input.chinese,
    pinyin: input.pinyin ?? null,
    korean: input.korean ?? null,
  } as never)
  if (error) {
    return { content: `단어장 저장 실패: ${error.message}`, isError: true }
  }
  return {
    content: `단어장에 저장했습니다: ${input.chinese}`,
    data: { chinese: input.chinese, pinyin: input.pinyin, korean: input.korean },
  }
}

/** generate_quiz: 정규화된 퀴즈를 결과로 감싼다(순수). */
export function buildQuizResult(quiz: TutorQuiz): TutorToolResult {
  const topicNote = quiz.topic ? ` (주제: ${quiz.topic})` : ''
  return {
    content: `${quiz.questions.length}문항 퀴즈를 생성했습니다${topicNote}.`,
    data: quiz,
  }
}

// ── 디스패처 ──────────────────────────────────────────────────────────────────
/**
 * 도구 이름으로 검증+핸들러를 실행한다. 검증/실행 오류는 던지지 않고 isError 결과로
 * 감싸 반환한다(tool_use 루프가 항상 tool_result 를 돌려줄 수 있도록).
 */
export async function runTutorTool(
  name: string,
  rawInput: unknown,
  ctx: TutorToolContext
): Promise<TutorToolResult> {
  try {
    switch (name) {
      case 'add_to_vocab':
        return await handleAddToVocab(validateAddToVocab(rawInput), ctx)
      case 'generate_quiz':
        return buildQuizResult(validateGenerateQuiz(rawInput))
      default:
        return { content: `알 수 없는 도구: ${name}`, isError: true }
    }
  } catch (e) {
    return { content: e instanceof Error ? e.message : '도구 실행 오류', isError: true }
  }
}
