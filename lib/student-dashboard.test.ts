import { describe, it, expect } from 'vitest'
import {
  BADGE_CATALOG,
  buildBadgeGrid,
  mapErrorCard,
  accuracyPct,
  formatMonthDay,
  type ErrorCardRow,
} from './student-dashboard'

describe('buildBadgeGrid', () => {
  it('marks earned badges and leaves the rest locked', () => {
    const grid = buildBadgeGrid(['streak_7', 'vocab_100'])
    expect(grid).toHaveLength(BADGE_CATALOG.length)
    const earned = grid.filter((b) => b.earned).map((b) => b.id).sort()
    expect(earned).toEqual(['streak_7', 'vocab_100'])
    expect(grid.find((b) => b.id === 'zero_error')?.earned).toBe(false)
  })

  it('ignores unknown badge types (no crash, none matched)', () => {
    const grid = buildBadgeGrid(['nonexistent'])
    expect(grid.every((b) => !b.earned)).toBe(true)
  })

  it('returns all locked for empty input', () => {
    expect(buildBadgeGrid([]).every((b) => !b.earned)).toBe(true)
  })
})

describe('accuracyPct', () => {
  it('returns 0 when there are no cards', () => {
    expect(accuracyPct(0, 0)).toBe(0)
  })
  it('rounds resolved / total to a percentage', () => {
    expect(accuracyPct(10, 9)).toBe(90)
    expect(accuracyPct(3, 1)).toBe(33)
    expect(accuracyPct(8, 7)).toBe(88)
  })
  it('handles all-resolved', () => {
    expect(accuracyPct(5, 5)).toBe(100)
  })
})

describe('formatMonthDay', () => {
  it('formats an ISO date as MM.DD', () => {
    expect(formatMonthDay('2026-06-21T09:00:00.000Z')).toMatch(/^\d{2}\.\d{2}$/)
  })
  it('returns empty string on invalid input', () => {
    expect(formatMonthDay('not-a-date')).toBe('')
  })
})

describe('mapErrorCard', () => {
  const base: ErrorCardRow = {
    id: 'c1',
    error_span: '看书在图书馆',
    error_type: 'grammar',
    error_subtype: '어순',
    correction: '在图书馆看书',
    explanation: '장소는 동사 앞에 와요.',
    chapter_number: 3,
    created_at: '2026-06-21T09:00:00.000Z',
  }

  it('maps a full row to UI fields', () => {
    const item = mapErrorCard(base)
    expect(item.id).toBe('c1')
    expect(item.category).toBe('어순')
    expect(item.chapter).toBe('3과')
    expect(item.before.mark).toBe('看书在图书馆')
    expect(item.after).toBe('在图书馆看书')
    expect(item.note).toBe('장소는 동사 앞에 와요.')
  })

  it('falls back category to error_type label when subtype missing', () => {
    expect(mapErrorCard({ ...base, error_subtype: null }).category).toBe('문법')
    expect(
      mapErrorCard({ ...base, error_type: 'vocab', error_subtype: '  ' }).category
    ).toBe('어휘')
  })

  it('uses "자유 작문" for chapter 0', () => {
    expect(mapErrorCard({ ...base, chapter_number: 0 }).chapter).toBe('자유 작문')
  })

  it('falls back after-text to the error span when correction is empty', () => {
    expect(mapErrorCard({ ...base, correction: null }).after).toBe('看书在图书馆')
  })
})
