import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveSpeciesCode,
  processGraduations,
  GRADUATION_MASTERY_REWARD
} from './graduation'
import { awardMasteryPoints } from './gamification'
import { createInAppNotification } from './in-app-notifications'

let mockErrorCards: { data: unknown; error: null | { message: string } } = { data: [], error: null }
let mockRpc: { data: unknown; error: null | { message: string } } = {
  data: [{ newly_graduated: true }],
  error: null
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve(mockErrorCards))
    }))
  })),
  rpc: vi.fn(() => Promise.resolve(mockRpc))
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))
vi.mock('./gamification', () => ({
  awardMasteryPoints: vi.fn().mockResolvedValue({ activityCoins: 0, masteryPoints: 5 })
}))
vi.mock('./in-app-notifications', () => ({
  createInAppNotification: vi.fn().mockResolvedValue('nid')
}))

// 어제(2026-06-18) 기준, cutoff = 06-04. 그 이전 lastSeen 이면 조용함.
const NOW = '2026-06-18T00:00:00Z'
const OLD = '2026-05-01T00:00:00Z' // quiet (졸업 후보)
const RECENT = '2026-06-17T00:00:00Z' // 최근 재발

function cards(subtype: string, createdAts: string[]) {
  return createdAts.map((created_at) => ({ error_subtype: subtype, created_at }))
}

describe('resolveSpeciesCode()', () => {
  it('subtype 안의 종 키워드를 코드로 매핑', () => {
    expect(resolveSpeciesCode('把자문 오류')).toBe('ba_construction')
    expect(resolveSpeciesCode('어순 오류')).toBe('word_order')
    expect(resolveSpeciesCode('错词 사용')).toBe('wrong_word')
  })
  it('매핑 불가 → null', () => {
    expect(resolveSpeciesCode('대명사 오류')).toBeNull()
    expect(resolveSpeciesCode('')).toBeNull()
  })
})

describe('processGraduations()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorCards = { data: [], error: null }
    mockRpc = { data: [{ newly_graduated: true }], error: null }
  })

  it('화석화 임계 미달(2회) → 졸업 없음', async () => {
    mockErrorCards = { data: cards('어순 오류', [OLD, OLD]), error: null }
    const out = await processGraduations('s1', NOW)
    expect(out).toEqual([])
    expect(awardMasteryPoints).not.toHaveBeenCalled()
  })

  it('최근 재발(14일 내) → 졸업 없음', async () => {
    mockErrorCards = { data: cards('어순 오류', [OLD, OLD, RECENT]), error: null }
    const out = await processGraduations('s1', NOW)
    expect(out).toEqual([])
  })

  it('화석화 + 조용 + 매핑 가능 + newly → 졸업, mastery 적립, 알림', async () => {
    mockErrorCards = { data: cards('把자문 오류', [OLD, OLD, OLD]), error: null }
    const out = await processGraduations('s1', NOW)
    expect(out).toEqual([{ code: 'ba_construction', subtype: '把자문 오류' }])
    expect(awardMasteryPoints).toHaveBeenCalledWith('s1', GRADUATION_MASTERY_REWARD)
    expect(createInAppNotification).toHaveBeenCalledOnce()
    expect(mockSupabase.rpc).toHaveBeenCalledWith('record_dex_graduation', {
      p_student_id: 's1',
      p_code: 'ba_construction'
    })
  })

  it('이미 졸업한 종(newly=false) → 보상/알림 없음', async () => {
    mockErrorCards = { data: cards('把자문 오류', [OLD, OLD, OLD]), error: null }
    mockRpc = { data: [{ newly_graduated: false }], error: null }
    const out = await processGraduations('s1', NOW)
    expect(out).toEqual([])
    expect(awardMasteryPoints).not.toHaveBeenCalled()
  })

  it('매핑 불가 subtype 은 졸업 후보에서 제외', async () => {
    mockErrorCards = { data: cards('대명사 오류', [OLD, OLD, OLD]), error: null }
    const out = await processGraduations('s1', NOW)
    expect(out).toEqual([])
    expect(mockSupabase.rpc).not.toHaveBeenCalled()
  })
})
