import { describe, it, expect } from 'vitest'
import { validateCriteria, computeTotalScore } from './rubrics'

const crit = (name: string, weight: number, max_score = 100) => ({
  name,
  description: '',
  weight,
  max_score,
})

describe('validateCriteria', () => {
  it('rejects non-arrays and empty arrays', () => {
    expect(validateCriteria(null).ok).toBe(false)
    expect(validateCriteria([]).ok).toBe(false)
  })
  it('rejects more than 10 criteria', () => {
    const many = Array.from({ length: 11 }, (_, i) => crit(`c${i}`, 100 / 11))
    expect(validateCriteria(many).ok).toBe(false)
  })
  it('rejects malformed items and missing names', () => {
    expect(validateCriteria(['x']).ok).toBe(false)
    expect(validateCriteria([{ weight: 100 }]).ok).toBe(false)
  })
  it('rejects non-positive weight / max_score', () => {
    expect(validateCriteria([crit('a', 0)]).ok).toBe(false)
    expect(validateCriteria([crit('a', 100, 0)]).ok).toBe(false)
  })
  it('rejects when weights do not sum to ~100', () => {
    const r = validateCriteria([crit('a', 50), crit('b', 30)])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('100')
  })
  it('accepts valid criteria within ±0.5 tolerance and trims names', () => {
    const r = validateCriteria([
      { name: '  내용  ', description: 'd', weight: 60, max_score: 10 },
      crit('형식', 40.3),
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.criteria).toHaveLength(2)
      expect(r.criteria[0].name).toBe('내용')
      expect(r.criteria[0].max_score).toBe(10)
    }
  })
  it('defaults max_score to 100 when absent', () => {
    const r = validateCriteria([{ name: 'a', weight: 100 }])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.criteria[0].max_score).toBe(100)
  })
})

describe('computeTotalScore', () => {
  const criteria = [crit('a', 70, 10), crit('b', 30, 5)]
  it('returns 0 with no matching scores', () => {
    expect(computeTotalScore([], criteria)).toBe(0)
    expect(computeTotalScore([{ criterion: 'zzz', score: 5, max_score: 10, feedback: '' }], criteria)).toBe(0)
  })
  it('weights ratios across criteria and scales to 0..100', () => {
    // a: 10/10=1.0 * 70 ; b: 5/5=1.0 * 30  => 100
    expect(
      computeTotalScore(
        [
          { criterion: 'a', score: 10, max_score: 10, feedback: '' },
          { criterion: 'b', score: 5, max_score: 5, feedback: '' },
        ],
        criteria
      )
    ).toBe(100)
  })
  it('clamps per-criterion ratio to [0,1] and partials correctly', () => {
    // a: 5/10=0.5 *70=35 ; b: over-max clamps to 1.0 *30=30 ; total weight 100 => 65
    expect(
      computeTotalScore(
        [
          { criterion: 'a', score: 5, max_score: 10, feedback: '' },
          { criterion: 'b', score: 999, max_score: 5, feedback: '' },
        ],
        criteria
      )
    ).toBe(65)
  })
  it('normalizes when only some criteria are scored', () => {
    // only a scored fully: weighted=70, totalWeight=70 => 70/70*100 = 100
    expect(
      computeTotalScore([{ criterion: 'a', score: 10, max_score: 10, feedback: '' }], criteria)
    ).toBe(100)
  })
})
