import { describe, it, expect, vi } from 'vitest'
import {
  TUTOR_TOOLS,
  TUTOR_TOOL_NAMES,
  validateAddToVocab,
  validateGenerateQuiz,
  handleAddToVocab,
  buildQuizResult,
  runTutorTool,
  MAX_QUIZ_QUESTIONS,
  type TutorToolContext,
} from './tutor-tools'

// 최소 supabase 더블: from().insert() 결과를 제어하고 insert 인자를 캡처한다.
function fakeSupabase(insertResult: { error: { message: string } | null }) {
  const insert = vi.fn().mockReturnValue(insertResult)
  const from = vi.fn().mockReturnValue({ insert })
  const ctx = { supabase: { from } as unknown, studentId: 'stu-1' } as TutorToolContext
  return { ctx, from, insert }
}

describe('TUTOR_TOOLS 정의', () => {
  it('add_to_vocab / generate_quiz 두 도구를 제공한다', () => {
    expect(TUTOR_TOOLS.map((t) => t.name).sort()).toEqual(['add_to_vocab', 'generate_quiz'])
    expect([...TUTOR_TOOL_NAMES].sort()).toEqual(['add_to_vocab', 'generate_quiz'])
  })

  it('각 도구는 object input_schema 와 required 를 갖는다', () => {
    for (const tool of TUTOR_TOOLS) {
      expect(tool.input_schema.type).toBe('object')
      expect(Array.isArray(tool.input_schema.required)).toBe(true)
    }
  })
})

describe('validateAddToVocab', () => {
  it('chinese 를 트림해 반환하고 선택 필드를 정규화한다', () => {
    expect(validateAddToVocab({ chinese: '  把  ', pinyin: ' bǎ ', korean: ' ~을 ' })).toEqual({
      chinese: '把',
      pinyin: 'bǎ',
      korean: '~을',
    })
  })

  it('빈 pinyin/korean 은 생략(undefined)', () => {
    expect(validateAddToVocab({ chinese: '词', pinyin: '   ' })).toEqual({ chinese: '词' })
  })

  it('chinese 누락/빈값이면 throw', () => {
    expect(() => validateAddToVocab({})).toThrow(/chinese/)
    expect(() => validateAddToVocab({ chinese: '   ' })).toThrow(/chinese/)
  })
})

describe('validateGenerateQuiz', () => {
  const good = {
    topic: '把자문',
    questions: [
      { prompt: '올바른 어순은?', options: ['把书放', '放把书'], answer_index: 0, explanation: 'OK' },
    ],
  }

  it('유효한 퀴즈를 정규화한다(answerIndex 카멜케이스로)', () => {
    const q = validateGenerateQuiz(good)
    expect(q.topic).toBe('把자문')
    expect(q.questions).toHaveLength(1)
    expect(q.questions[0]).toMatchObject({ answerIndex: 0, explanation: 'OK' })
  })

  it('보기가 2개 미만이거나 정답 인덱스가 범위를 벗어난 문항은 버린다', () => {
    expect(() =>
      validateGenerateQuiz({
        questions: [
          { prompt: 'A', options: ['단일'], answer_index: 0 }, // 보기 1개 → 버림
          { prompt: 'B', options: ['x', 'y'], answer_index: 5 }, // 인덱스 초과 → 버림
        ],
      })
    ).toThrow(/유효한 문항/)
  })

  it('유효 문항이 하나도 없으면 throw', () => {
    expect(() => validateGenerateQuiz({ questions: [] })).toThrow(/유효한 문항/)
  })

  it('최대 문항 수를 초과하면 잘라낸다', () => {
    const many = {
      questions: Array.from({ length: MAX_QUIZ_QUESTIONS + 5 }, (_, i) => ({
        prompt: `Q${i}`,
        options: ['a', 'b'],
        answer_index: 1,
      })),
    }
    expect(validateGenerateQuiz(many).questions).toHaveLength(MAX_QUIZ_QUESTIONS)
  })
})

describe('handleAddToVocab', () => {
  it('학습자 단어장에 정확한 행을 insert 하고 성공 결과를 돌려준다', async () => {
    const { ctx, from, insert } = fakeSupabase({ error: null })
    const res = await handleAddToVocab({ chinese: '把', pinyin: 'bǎ' }, ctx)
    expect(from).toHaveBeenCalledWith('vocabulary')
    expect(insert).toHaveBeenCalledWith({
      student_id: 'stu-1',
      chinese: '把',
      pinyin: 'bǎ',
      korean: null,
    })
    expect(res.isError).toBeUndefined()
    expect(res.content).toContain('把')
  })

  it('insert 오류 시 isError 결과', async () => {
    const { ctx } = fakeSupabase({ error: { message: 'duplicate' } })
    const res = await handleAddToVocab({ chinese: '词' }, ctx)
    expect(res.isError).toBe(true)
    expect(res.content).toContain('duplicate')
  })
})

describe('buildQuizResult', () => {
  it('문항 수와 주제를 요약한다', () => {
    const res = buildQuizResult({ topic: '语序', questions: [{ prompt: 'p', options: ['a', 'b'], answerIndex: 0 }] })
    expect(res.content).toContain('1문항')
    expect(res.content).toContain('语序')
    expect(res.data).toBeTruthy()
  })
})

describe('runTutorTool', () => {
  it('add_to_vocab 를 디스패치한다', async () => {
    const { ctx, insert } = fakeSupabase({ error: null })
    const res = await runTutorTool('add_to_vocab', { chinese: '学习' }, ctx)
    expect(insert).toHaveBeenCalled()
    expect(res.isError).toBeUndefined()
  })

  it('generate_quiz 를 디스패치한다', async () => {
    const { ctx } = fakeSupabase({ error: null })
    const res = await runTutorTool(
      'generate_quiz',
      { questions: [{ prompt: 'p', options: ['a', 'b'], answer_index: 1 }] },
      ctx
    )
    expect(res.isError).toBeUndefined()
    expect(res.content).toContain('1문항')
  })

  it('검증 오류를 throw 하지 않고 isError 로 감싼다', async () => {
    const { ctx } = fakeSupabase({ error: null })
    const res = await runTutorTool('add_to_vocab', {}, ctx)
    expect(res.isError).toBe(true)
    expect(res.content).toMatch(/chinese/)
  })

  it('알 수 없는 도구는 isError', async () => {
    const { ctx } = fakeSupabase({ error: null })
    const res = await runTutorTool('delete_everything', {}, ctx)
    expect(res.isError).toBe(true)
  })
})
