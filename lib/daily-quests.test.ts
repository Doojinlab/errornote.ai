import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ymd,
  previousYmd,
  aggregateYesterdayErrors,
  buildDailyQuestUserPrompt,
  parseDailyQuests,
  generateDailyQuestMissions,
  getOrCreateTodayQuest,
  MISSION_COUNT
} from './daily-quests'
import { dispatchJSON } from './ai/dispatch'

// ── mocks ─────────────────────────────────────────────────────────────────────

let mockDailyExisting: { data: unknown; error: null | { message: string } } = {
  data: null,
  error: null
}
let mockErrorCards: { data: unknown; error: null | { message: string } } = {
  data: [],
  error: null
}
let mockInserted: { data: unknown; error: null | { message: string } } = {
  data: null,
  error: null
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'daily_quests') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve(mockDailyExisting))
            }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockInserted))
          }))
        }))
      }
    }
    // error_cards: select().eq().gte().lt()
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lt: vi.fn(() => Promise.resolve(mockErrorCards))
          }))
        }))
      }))
    }
  })
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

vi.mock('./ai/dispatch', () => ({
  dispatchJSON: vi.fn()
}))

// ── 날짜 유틸 ─────────────────────────────────────────────────────────────────

describe('ymd() / previousYmd()', () => {
  it('ymd 는 UTC YYYY-MM-DD', () => {
    expect(ymd(new Date('2026-06-18T15:00:00Z'))).toBe('2026-06-18')
  })
  it('previousYmd 는 전날', () => {
    expect(previousYmd('2026-06-18')).toBe('2026-06-17')
  })
  it('월 경계도 처리', () => {
    expect(previousYmd('2026-07-01')).toBe('2026-06-30')
  })
})

// ── 파싱 ──────────────────────────────────────────────────────────────────────

describe('parseDailyQuests()', () => {
  const valid = JSON.stringify({
    missions: [
      { title: 'A', instruction: 'do A', source_label: '어순' },
      { title: 'B', instruction: 'do B', source_label: null },
      { title: 'C', instruction: 'do C' }
    ]
  })

  it('유효 응답 → 미션 3개, done=false, id 부여', () => {
    const m = parseDailyQuests(valid)
    expect(m).toHaveLength(3)
    expect(m[0]).toMatchObject({ id: 'm1', title: 'A', source_label: '어순', done: false })
    expect(m[1].source_label).toBeNull()
    expect(m[2].source_label).toBeNull() // 누락 → null
  })

  it('코드펜스로 감싼 응답도 파싱', () => {
    const m = parseDailyQuests('```json\n' + valid + '\n```')
    expect(m).toHaveLength(3)
  })

  it('3개 초과 → 3개로 clamp', () => {
    const raw = JSON.stringify({
      missions: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, instruction: `I${i}` }))
    })
    expect(parseDailyQuests(raw)).toHaveLength(MISSION_COUNT)
  })

  it('title/instruction 빈 항목은 제외', () => {
    const raw = JSON.stringify({ missions: [{ title: '', instruction: 'x' }, { title: 'ok', instruction: 'y' }] })
    const m = parseDailyQuests(raw)
    expect(m).toHaveLength(1)
    expect(m[0].title).toBe('ok')
  })

  it('missions 배열 없음 → throw', () => {
    expect(() => parseDailyQuests('{"foo":1}')).toThrow('missions 배열이 없습니다')
  })

  it('유효 미션 0개 → throw', () => {
    expect(() => parseDailyQuests('{"missions":[{"title":"","instruction":""}]}')).toThrow(
      '유효한 미션이 없습니다'
    )
  })

  it('잘못된 JSON → throw', () => {
    expect(() => parseDailyQuests('not json')).toThrow()
  })
})

// ── 프롬프트 ──────────────────────────────────────────────────────────────────

describe('buildDailyQuestUserPrompt()', () => {
  it('오류 있으면 유형·횟수를 포함', () => {
    const p = buildDailyQuestUserPrompt({
      top: [
        { code: null, label: '어순', count: 4 },
        { code: null, label: '把자문', count: 2 }
      ],
      total_errors: 6
    })
    expect(p).toContain('어순 (4회)')
    expect(p).toContain('把자문 (2회)')
    expect(p).toContain('6개')
  })

  it('오류 없으면 무벌점 재시작 톤', () => {
    const p = buildDailyQuestUserPrompt({ top: [], total_errors: 0 })
    expect(p).toContain('오류가 없어요')
  })
})

// ── 집계 ──────────────────────────────────────────────────────────────────────

describe('aggregateYesterdayErrors()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subtype 별 집계 후 상위 N, total_errors 반환', async () => {
    mockErrorCards = {
      data: [
        { error_subtype: '어순' },
        { error_subtype: '어순' },
        { error_subtype: '把자문' },
        { error_subtype: null }, // 무시
        { error_subtype: '  ' } // 무시
      ],
      error: null
    }
    const src = await aggregateYesterdayErrors(mockSupabase as never, 's1', '2026-06-18')
    expect(src.total_errors).toBe(5)
    expect(src.top[0]).toEqual({ code: null, label: '어순', count: 2 })
    expect(src.top.find((t) => t.label === '把자문')?.count).toBe(1)
  })

  it('조회 실패 → throw', async () => {
    mockErrorCards = { data: null, error: { message: 'boom' } }
    await expect(aggregateYesterdayErrors(mockSupabase as never, 's1', '2026-06-18')).rejects.toThrow(
      'error_cards 조회 실패'
    )
  })
})

// ── 생성 ──────────────────────────────────────────────────────────────────────

describe('generateDailyQuestMissions()', () => {
  beforeEach(() => vi.clearAllMocks())

  it("dispatchJSON 을 'daily-quest' task 로 호출하고 결과 반환", async () => {
    const missions = [{ id: 'm1', title: 'A', instruction: 'a', source_code: null, source_label: null, done: false }]
    vi.mocked(dispatchJSON).mockResolvedValue(missions)
    const result = await generateDailyQuestMissions({ top: [], total_errors: 0 })
    expect(dispatchJSON).toHaveBeenCalledWith('daily-quest', expect.any(Object), expect.any(Function))
    expect(result).toEqual(missions)
  })
})

// ── getOrCreate ───────────────────────────────────────────────────────────────

describe('getOrCreateTodayQuest()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDailyExisting = { data: null, error: null }
    mockErrorCards = { data: [], error: null }
    mockInserted = { data: null, error: null }
  })

  it('오늘 퀘스트가 이미 있으면 그대로 반환(생성 안 함)', async () => {
    mockDailyExisting = {
      data: {
        id: 'q1',
        student_id: 's1',
        quest_date: '2026-06-18',
        source: { top: [], total_errors: 0 },
        missions: [{ id: 'm1', title: 'A', instruction: 'a', source_code: null, source_label: null, done: false }],
        created_at: '2026-06-18T00:00:00Z'
      },
      error: null
    }
    const q = await getOrCreateTodayQuest('s1')
    expect(q.id).toBe('q1')
    expect(q.missions).toHaveLength(1)
    expect(dispatchJSON).not.toHaveBeenCalled()
  })

  it('없으면 어제 오류로 생성 후 insert 결과 반환', async () => {
    mockDailyExisting = { data: null, error: null }
    mockErrorCards = { data: [{ error_subtype: '어순' }], error: null }
    const missions = [{ id: 'm1', title: 'A', instruction: 'a', source_code: null, source_label: '어순', done: false }]
    vi.mocked(dispatchJSON).mockResolvedValue(missions)
    mockInserted = {
      data: {
        id: 'q2',
        student_id: 's1',
        quest_date: '2026-06-18',
        source: { top: [{ code: null, label: '어순', count: 1 }], total_errors: 1 },
        missions,
        created_at: '2026-06-18T00:00:00Z'
      },
      error: null
    }
    const q = await getOrCreateTodayQuest('s1')
    expect(dispatchJSON).toHaveBeenCalledOnce()
    expect(q.id).toBe('q2')
    expect(q.missions[0].source_label).toBe('어순')
  })
})
