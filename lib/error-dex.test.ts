import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listErrorSpecies, getDex, recordDexEncounter } from './error-dex'

// ── mock supabase ─────────────────────────────────────────────────────────────

type Res = { data: unknown; error: null | { message: string } }

let speciesRes: Res = { data: [], error: null }
let entriesRes: Res = { data: [], error: null }
let rpcRes: Res = { data: null, error: null }

const mockSupabase = {
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      // error_species: .select().order()
      order: vi.fn(() =>
        Promise.resolve(table === 'error_species' ? speciesRes : { data: [], error: null })
      ),
      // user_dex_entries: .select().eq()
      eq: vi.fn(() =>
        Promise.resolve(table === 'user_dex_entries' ? entriesRes : { data: [], error: null })
      )
    }))
  })),
  rpc: vi.fn((_fn: string, _args: unknown) => Promise.resolve(rpcRes))
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

const SPECIES = [
  {
    id: 'sp-ba',
    code: 'ba_construction',
    category: 'grammar',
    name_zh: '把字句',
    name_ko: '把자문',
    hsk_level: 4,
    description: '处置 把자문.',
    sort_order: 10
  },
  {
    id: 'sp-order',
    code: 'word_order',
    category: 'grammar',
    name_zh: '语序',
    name_ko: '어순',
    hsk_level: 2,
    description: '어순 규칙 위반.',
    sort_order: 20
  },
  {
    id: 'sp-cw',
    code: 'wrong_word',
    category: 'vocab',
    name_zh: '错词',
    name_ko: '错词',
    hsk_level: 2,
    description: '단어 선택 오류.',
    sort_order: 110
  }
]

beforeEach(() => {
  vi.clearAllMocks()
  speciesRes = { data: SPECIES, error: null }
  entriesRes = { data: [], error: null }
  rpcRes = { data: null, error: null }
})

describe('listErrorSpecies()', () => {
  it('마스터 종 목록을 반환', async () => {
    const list = await listErrorSpecies()
    expect(list).toHaveLength(3)
    expect(list[0].code).toBe('ba_construction')
  })

  it('DB error → throw', async () => {
    speciesRes = { data: null, error: { message: 'boom' } }
    await expect(listErrorSpecies()).rejects.toThrow('error_species 조회 실패')
  })
})

describe('getDex()', () => {
  it('수집 항목이 없으면 전 종을 unseen 으로 반환', async () => {
    entriesRes = { data: [], error: null }
    const dex = await getDex('s1')
    expect(dex).toHaveLength(3)
    expect(dex.every((c) => c.status === 'unseen')).toBe(true)
    expect(dex[0].encounterCount).toBe(0)
  })

  it('학습자 수집 상태를 해당 종에 입힌다', async () => {
    entriesRes = {
      data: [
        { species_id: 'sp-ba', status: 'graduated', encounter_count: 5, graduated_at: '2026-06-01' },
        { species_id: 'sp-order', status: 'encountered', encounter_count: 2, graduated_at: null }
      ],
      error: null
    }
    const dex = await getDex('s1')
    const ba = dex.find((c) => c.species.code === 'ba_construction')!
    const order = dex.find((c) => c.species.code === 'word_order')!
    const cw = dex.find((c) => c.species.code === 'wrong_word')!
    expect(ba.status).toBe('graduated')
    expect(ba.graduatedAt).toBe('2026-06-01')
    expect(order.status).toBe('encountered')
    expect(order.encounterCount).toBe(2)
    expect(cw.status).toBe('unseen') // 수집 항목 없음
  })

  it('species 조회 실패 → throw', async () => {
    speciesRes = { data: null, error: { message: 'sp boom' } }
    await expect(getDex('s1')).rejects.toThrow('error_species 조회 실패')
  })

  it('entries 조회 실패 → throw', async () => {
    entriesRes = { data: null, error: { message: 'ent boom' } }
    await expect(getDex('s1')).rejects.toThrow('user_dex_entries 조회 실패')
  })
})

describe('recordDexEncounter()', () => {
  it('RPC 결과를 반환', async () => {
    rpcRes = { data: [{ status: 'encountered', encounter_count: 1 }], error: null }
    const r = await recordDexEncounter('s1', 'ba_construction')
    expect(mockSupabase.rpc).toHaveBeenCalledWith('record_dex_encounter', {
      p_student_id: 's1',
      p_code: 'ba_construction'
    })
    expect(r).toEqual({ status: 'encountered', encounterCount: 1 })
  })

  it('RPC error → throw', async () => {
    rpcRes = { data: null, error: { message: 'rpc boom' } }
    await expect(recordDexEncounter('s1', 'ba_construction')).rejects.toThrow(
      'record_dex_encounter RPC 실패'
    )
  })

  it('빈 결과 → throw', async () => {
    rpcRes = { data: [], error: null }
    await expect(recordDexEncounter('s1', 'ba_construction')).rejects.toThrow('비어 있습니다')
  })
})
