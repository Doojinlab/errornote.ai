import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  aggregateLearnerProfile,
  buildLearnerProfileSection,
  assessDifficulty,
  buildAdaptiveDifficultySection,
  getTutorContext,
  PROFILE_TOP_N,
  type LearnerProfile
} from './tutor-context'

function profileOf(over: Partial<LearnerProfile> = {}): LearnerProfile {
  return { recurring: [], hskRange: null, totalRecent: 0, ...over }
}

let mockResult: { data: unknown; error: null | { message: string } } = { data: [], error: null }

// from('error_cards').select().eq().order().limit() 체인을 모킹
function chain() {
  const c: Record<string, unknown> = {}
  c.select = vi.fn(() => c)
  c.eq = vi.fn(() => c)
  c.order = vi.fn(() => c)
  c.limit = vi.fn(() => Promise.resolve(mockResult))
  return c
}
const mockSupabase = { from: vi.fn(() => chain()) }

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

function card(subtype: string | null, hsk: number | null = null) {
  return { error_subtype: subtype, hsk_level: hsk }
}

beforeEach(() => {
  mockResult = { data: [], error: null }
})

describe('aggregateLearnerProfile()', () => {
  it('subtype 별 집계 + 빈도 내림차순 + 화석화 플래그', async () => {
    mockResult = {
      data: [
        card('把字句', 4), card('把字句', 4), card('把字句', 3), // 3회 → 화석화
        card('语序', 2), card('语序', 2),                        // 2회
        card('量词', 1),                                          // 1회
        card('', 5), card(null, null)                            // 무시
      ],
      error: null
    }
    const p = await aggregateLearnerProfile(mockSupabase as never, 's1')
    expect(p.recurring[0]).toEqual({ subtype: '把字句', count: 3, fossilized: true })
    expect(p.recurring[1]).toEqual({ subtype: '语序', count: 2, fossilized: false })
    expect(p.recurring[2]).toEqual({ subtype: '量词', count: 1, fossilized: false })
    expect(p.hskRange).toEqual({ min: 1, max: 5 })
    expect(p.totalRecent).toBe(8)
  })

  it('상위 N개로 제한', async () => {
    mockResult = {
      data: Array.from({ length: PROFILE_TOP_N + 3 }, (_, i) => card(`type${i}`)),
      error: null
    }
    const p = await aggregateLearnerProfile(mockSupabase as never, 's1')
    expect(p.recurring.length).toBe(PROFILE_TOP_N)
  })

  it('HSK 없으면 hskRange=null', async () => {
    mockResult = { data: [card('语序', null)], error: null }
    const p = await aggregateLearnerProfile(mockSupabase as never, 's1')
    expect(p.hskRange).toBeNull()
  })

  it('조회 에러 → throw', async () => {
    mockResult = { data: null, error: { message: 'boom' } }
    await expect(aggregateLearnerProfile(mockSupabase as never, 's1')).rejects.toThrow(/boom/)
  })
})

describe('buildLearnerProfileSection()', () => {
  it('반복 유형/화석화/HSK 를 섹션 문자열로', () => {
    const profile: LearnerProfile = {
      recurring: [
        { subtype: '把字句', count: 4, fossilized: true },
        { subtype: '语序', count: 2, fossilized: false }
      ],
      hskRange: { min: 2, max: 4 },
      totalRecent: 10
    }
    const s = buildLearnerProfileSection(profile)!
    expect(s).toContain('학습자 오류 프로필')
    expect(s).toContain('把字句: 4회 (화석화 위험')
    expect(s).toContain('语序: 2회')
    expect(s).toContain('HSK 급수 범위: 2~4급')
  })

  it('반복 유형 없으면 null(주입 생략)', () => {
    const profile: LearnerProfile = { recurring: [], hskRange: null, totalRecent: 0 }
    expect(buildLearnerProfileSection(profile)).toBeNull()
  })

  it('HSK 범위 없으면 HSK 줄 생략', () => {
    const profile: LearnerProfile = {
      recurring: [{ subtype: '语序', count: 1, fossilized: false }],
      hskRange: null,
      totalRecent: 1
    }
    const s = buildLearnerProfileSection(profile)!
    expect(s).not.toContain('HSK 급수 범위')
  })
})

describe('assessDifficulty()', () => {
  it('화석화 유형 2개 이상 → foundational', () => {
    const p = profileOf({
      recurring: [
        { subtype: 'a', count: 3, fossilized: true },
        { subtype: 'b', count: 3, fossilized: true }
      ],
      hskRange: { min: 1, max: 6 }
    })
    expect(assessDifficulty(p)).toBe('foundational')
  })

  it('화석화 0 + HSK 5급 이상 → advanced', () => {
    const p = profileOf({
      recurring: [{ subtype: 'a', count: 1, fossilized: false }],
      hskRange: { min: 4, max: 5 }
    })
    expect(assessDifficulty(p)).toBe('advanced')
  })

  it('그 외 → standard', () => {
    const p = profileOf({
      recurring: [{ subtype: 'a', count: 1, fossilized: false }],
      hskRange: { min: 2, max: 3 }
    })
    expect(assessDifficulty(p)).toBe('standard')
    // 화석화 1개(임계 미만) + 고HSK 라도 advanced 아님(화석화>0)
    const p2 = profileOf({
      recurring: [{ subtype: 'a', count: 3, fossilized: true }],
      hskRange: { min: 5, max: 6 }
    })
    expect(assessDifficulty(p2)).toBe('standard')
  })

  it('빈 프로필 → standard', () => {
    expect(assessDifficulty(profileOf())).toBe('standard')
  })
})

describe('buildAdaptiveDifficultySection()', () => {
  it('난이도별 지시 문구', () => {
    const found = buildAdaptiveDifficultySection(
      profileOf({ recurring: [
        { subtype: 'a', count: 3, fossilized: true },
        { subtype: 'b', count: 3, fossilized: true }
      ] })
    )
    expect(found).toContain('설명 난이도')
    expect(found).toContain('쉬운 어휘')

    const adv = buildAdaptiveDifficultySection(
      profileOf({ recurring: [{ subtype: 'a', count: 1, fossilized: false }], hskRange: { min: 5, max: 6 } })
    )
    expect(adv).toContain('심화')
  })
})

describe('getTutorContext()', () => {
  it('한 번의 집계로 프로필+난이도 섹션 반환', async () => {
    mockResult = {
      data: [
        card('把字句', 4), card('把字句', 4), card('把字句', 3),
        card('语序', 5), card('语序', 5), card('语序', 4)
      ],
      error: null
    }
    const ctx = await getTutorContext('s1')
    expect(ctx.learnerProfileSection).toContain('把字句')
    // 把字句 3회(화석화) + 语序 3회(화석화) = 화석화 2개 → foundational
    expect(ctx.adaptiveDifficultySection).toContain('쉬운 어휘')
  })

  it('오류 없으면 프로필 null + standard 난이도', async () => {
    mockResult = { data: [], error: null }
    const ctx = await getTutorContext('s1')
    expect(ctx.learnerProfileSection).toBeNull()
    expect(ctx.adaptiveDifficultySection).toContain('표준 난이도')
  })
})
