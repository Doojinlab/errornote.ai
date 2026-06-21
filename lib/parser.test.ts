import { describe, it, expect } from 'vitest'
import {
  normalizeErrorType,
  extractFirstJsonObject,
  parseAnalysisResponse,
  extractAnnotatedSpans,
  stripErrorTags,
} from './parser'

describe('normalizeErrorType', () => {
  it('maps vocab aliases (en/zh/ko) to "vocab"', () => {
    for (const v of ['vocab', 'Vocabulary', 'LEXICAL', '词汇', '어휘']) {
      expect(normalizeErrorType(v)).toBe('vocab')
    }
  })
  it('defaults everything else to "grammar"', () => {
    for (const v of ['grammar', '', '语法', undefined, null, 123]) {
      expect(normalizeErrorType(v)).toBe('grammar')
    }
  })
})

describe('extractFirstJsonObject', () => {
  it('extracts a balanced object', () => {
    expect(extractFirstJsonObject('noise {"a":1} tail')).toBe('{"a":1}')
  })
  it('handles nested braces', () => {
    expect(extractFirstJsonObject('{"a":{"b":2}}')).toBe('{"a":{"b":2}}')
  })
  it('ignores braces inside strings', () => {
    expect(extractFirstJsonObject('{"a":"}{"}')).toBe('{"a":"}{"}')
  })
  it('respects escaped quotes inside strings', () => {
    expect(extractFirstJsonObject('{"a":"x\\"}"}')).toBe('{"a":"x\\"}"}')
  })
  it('strips ```json code fences', () => {
    expect(extractFirstJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('returns null when no object present', () => {
    expect(extractFirstJsonObject('no json here')).toBeNull()
    expect(extractFirstJsonObject('{ unbalanced')).toBeNull()
  })
})

describe('parseAnalysisResponse', () => {
  it('parses errors and fills defaults', () => {
    const raw = JSON.stringify({
      annotated_text: '<ERR id=0>错</ERR>词',
      overall_feedback: 'good',
      errors: [{ error_span: '错', error_type: '词汇', hsk_level: 9 }],
    })
    const res = parseAnalysisResponse(raw)
    expect(res.error_count).toBe(1) // derived from errors.length
    expect(res.errors[0].id).toBe(0) // index fallback
    expect(res.errors[0].error_type).toBe('vocab')
    expect(res.errors[0].hsk_level).toBe(6) // clamped to 1..6
    expect(res.errors[0].cot_reasoning).toEqual([])
  })
  it('uses explicit error_count and optional fluency_suggestion', () => {
    const res = parseAnalysisResponse(
      JSON.stringify({ error_count: 5, errors: [], fluency_suggestion: '더 자연스럽게' })
    )
    expect(res.error_count).toBe(5)
    expect(res.fluency_suggestion).toBe('더 자연스럽게')
  })
  it('omits blank fluency_suggestion', () => {
    const res = parseAnalysisResponse(JSON.stringify({ errors: [], fluency_suggestion: '   ' }))
    expect(res.fluency_suggestion).toBeUndefined()
  })
  it('throws when no JSON object found', () => {
    expect(() => parseAnalysisResponse('garbage')).toThrow()
  })
})

describe('extractAnnotatedSpans / stripErrorTags', () => {
  const text = 'A<ERR id=1>foo</ERR>B<ERR id=2>bar</ERR>'
  it('extracts spans with ids and offsets', () => {
    const spans = extractAnnotatedSpans(text)
    expect(spans.map((s) => [s.id, s.text])).toEqual([
      [1, 'foo'],
      [2, 'bar'],
    ])
    expect(spans[0].start).toBeLessThan(spans[1].start)
  })
  it('strips tags but keeps inner text', () => {
    expect(stripErrorTags(text)).toBe('AfooBbar')
  })
})
