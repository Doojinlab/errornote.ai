import { describe, it, expect } from 'vitest'
import {
  BADGE_CATALOG,
  buildBadgeGrid,
  mapErrorCard,
  accuracyPct,
  formatMonthDay,
  chapterTeaser,
  pickFocusChapter,
  mapCardnewsTeasers,
  type ErrorCardRow,
} from './student-dashboard'
import type {
  Card1ErrorsData,
  Card2ImprovedData,
  Card3TodoNowData,
  Card4NextWeekData,
} from '@/types/cardnews'

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

describe('chapterTeaser', () => {
  it('labels chapter 0 as 기초 and clamps id to 0', () => {
    const t = chapterTeaser(0)
    expect(t.chapterId).toBe(0)
    expect(t.title).toBe('오늘의 학습 · 기초')
    expect(t.subtitle.length).toBeGreaterThan(0)
  })

  it('labels a normal chapter as "N과" with a non-empty subtitle from prompts', () => {
    const t = chapterTeaser(3)
    expect(t.chapterId).toBe(3)
    expect(t.title).toBe('오늘의 학습 · 3과')
    expect(t.subtitle).not.toContain('(')
    expect(t.subtitle.length).toBeGreaterThan(0)
  })

  it('treats negative chapters as 기초 and clamps the id', () => {
    const t = chapterTeaser(-2)
    expect(t.chapterId).toBe(0)
    expect(t.title).toBe('오늘의 학습 · 기초')
  })

  it('falls back to a default subtitle for an unknown chapter', () => {
    const t = chapterTeaser(99)
    expect(t.title).toBe('오늘의 학습 · 99과')
    expect(t.subtitle).toBe('오늘도 한 문장씩 시작해요')
  })
})

describe('pickFocusChapter', () => {
  it('picks the most frequent error chapter', () => {
    expect(pickFocusChapter([3, 3, 5, 3, 5], null)).toBe(3)
  })

  it('ignores non-integer chapters', () => {
    expect(pickFocusChapter([NaN, 2, 2], null)).toBe(2)
  })

  it('falls back to the last session chapter when there are no errors', () => {
    expect(pickFocusChapter([], 4)).toBe(4)
  })

  it('falls back to 0 when there are neither errors nor sessions', () => {
    expect(pickFocusChapter([], null)).toBe(0)
  })
})

describe('mapCardnewsTeasers', () => {
  const card1: Card1ErrorsData = {
    total_errors: 12,
    grammar_count: 7,
    vocab_count: 5,
    by_subtype: [{ name: '어순', value: 4 }],
    week_summary: '이번 주 어순 오류가 줄었어요',
  }
  const card2: Card2ImprovedData = {
    headline: '把자문이 좋아졌어요',
    improved_subtype: '把자문',
    previous_count: 8,
    current_count: 2,
    delta: 6,
    positive_note: '꾸준함이 보여요',
  }
  const card3: Card3TodoNowData = {
    action_title: '어순 퀴즈 5개',
    action_detail: '5분만 투자해 보세요',
    estimated_minutes: 5,
    goal_progress_percent: 60,
    goal_label: '어순',
  }
  const card4: Card4NextWeekData = {
    next_chapter_number: 4,
    next_chapter_title: '4과 — 보어',
    preview_points: ['결과보어 미리보기'],
    focus_grammar: '정도보어',
  }

  it('maps all four report parts to rail teasers with the right tones', () => {
    const items = mapCardnewsTeasers({ card1, card2, card3, card4 })
    expect(items.map((i) => i.id)).toEqual([
      'cn-errors',
      'cn-improved',
      'cn-todo',
      'cn-next',
    ])
    expect(items.map((i) => i.tone)).toEqual(['blue', 'jade', 'gold', 'gem'])
    expect(items[0].title).toBe('이번 주 어순 오류가 줄었어요')
    expect(items[0].summary).toContain('총 12건')
    expect(items[2].summary).toContain('5분')
    expect(items[3].summary).toBe('결과보어 미리보기')
  })

  it('skips null cards', () => {
    const items = mapCardnewsTeasers({ card1, card2: null, card3: null, card4: null })
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('cn-errors')
    expect(mapCardnewsTeasers({ card1: null, card2: null, card3: null, card4: null })).toEqual([])
  })

  it('uses fallback titles/summaries when fields are blank', () => {
    const items = mapCardnewsTeasers({
      card1: { ...card1, week_summary: '   ' },
      card2: { ...card2, headline: '', positive_note: '   ' },
      card3,
      card4: { ...card4, next_chapter_title: '', preview_points: [], focus_grammar: '대체 문법' },
    })
    expect(items[0].title).toBe('이번 주 오류 리포트')
    expect(items[1].title).toBe('잘하고 있어요')
    expect(items[1].summary).toBeUndefined()
    expect(items[3].title).toBe('다음 주 학습')
    expect(items[3].summary).toBe('대체 문법')
  })
})
