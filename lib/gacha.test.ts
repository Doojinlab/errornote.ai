import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listRewardItems,
  getRewardInventory,
  pullGacha,
  GACHA_COST
} from './gacha'

// ── mock 외부 의존성 ──────────────────────────────────────────────────────────

let mockItemsData: { data: unknown; error: null | { message: string } } = { data: [], error: null }
let mockOwnedData: { data: unknown; error: null | { message: string } } = { data: [], error: null }
let mockRpcResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }

const rpcSpy = vi.fn()

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'reward_items') {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue(mockItemsData)
        })
      }
    }
    // reward_inventory
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(mockOwnedData)
      })
    }
  }),
  rpc: vi.fn((fn: string, args: unknown) => {
    rpcSpy(fn, args)
    return Promise.resolve(mockRpcResult)
  })
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

function item(code: string, rarity = 'common', id = code + '-id') {
  return {
    id,
    code,
    category: 'theme',
    name_ko: code + '_ko',
    name_zh: code + '_zh',
    rarity,
    icon: '🎨',
    sort_order: 1
  }
}

beforeEach(() => {
  mockItemsData = { data: [], error: null }
  mockOwnedData = { data: [], error: null }
  mockRpcResult = { data: null, error: null }
  rpcSpy.mockClear()
})

// ── listRewardItems ───────────────────────────────────────────────────────────

describe('listRewardItems()', () => {
  it('snake_case → camelCase 매핑', async () => {
    mockItemsData = { data: [item('theme_ink')], error: null }
    const res = await listRewardItems()
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ code: 'theme_ink', nameKo: 'theme_ink_ko', nameZh: 'theme_ink_zh' })
  })

  it('에러 → throw', async () => {
    mockItemsData = { data: null, error: { message: 'boom' } }
    await expect(listRewardItems()).rejects.toThrow(/boom/)
  })
})

// ── getRewardInventory ────────────────────────────────────────────────────────

describe('getRewardInventory()', () => {
  it('보유 여부를 카탈로그에 입힌다', async () => {
    mockItemsData = {
      data: [item('theme_ink', 'common', 'a'), item('theme_dragon', 'rare', 'b')],
      error: null
    }
    mockOwnedData = { data: [{ item_id: 'a', acquired_at: '2026-06-20T00:00:00Z' }], error: null }
    const cells = await getRewardInventory('s1')
    const ink = cells.find((c) => c.id === 'a')!
    const dragon = cells.find((c) => c.id === 'b')!
    expect(ink.owned).toBe(true)
    expect(ink.acquiredAt).toBe('2026-06-20T00:00:00Z')
    expect(dragon.owned).toBe(false)
    expect(dragon.acquiredAt).toBeNull()
  })

  it('items 조회 에러 → throw', async () => {
    mockItemsData = { data: null, error: { message: 'items fail' } }
    await expect(getRewardInventory('s1')).rejects.toThrow(/items fail/)
  })

  it('inventory 조회 에러 → throw', async () => {
    mockItemsData = { data: [item('x')], error: null }
    mockOwnedData = { data: null, error: { message: 'inv fail' } }
    await expect(getRewardInventory('s1')).rejects.toThrow(/inv fail/)
  })
})

// ── pullGacha ─────────────────────────────────────────────────────────────────

describe('pullGacha()', () => {
  it('RPC 결과 매핑 + 기본 비용 전달', async () => {
    mockRpcResult = {
      data: [{ item_code: 'theme_dragon', item_id: 'b', rarity: 'rare', is_duplicate: false, activity_coins: 70 }],
      error: null
    }
    const res = await pullGacha('s1')
    expect(res).toEqual({
      itemCode: 'theme_dragon',
      itemId: 'b',
      rarity: 'rare',
      isDuplicate: false,
      activityCoins: 70
    })
    expect(rpcSpy).toHaveBeenCalledWith('pull_gacha', { p_student_id: 's1', p_cost: GACHA_COST })
  })

  it('중복 결과도 그대로 매핑(환급 반영된 잔액)', async () => {
    mockRpcResult = {
      data: [{ item_code: 'theme_ink', item_id: 'a', rarity: 'common', is_duplicate: true, activity_coins: 85 }],
      error: null
    }
    const res = await pullGacha('s1', 30)
    expect(res.isDuplicate).toBe(true)
    expect(res.activityCoins).toBe(85)
    expect(rpcSpy).toHaveBeenCalledWith('pull_gacha', { p_student_id: 's1', p_cost: 30 })
  })

  it('잔액 부족(RPC 에러) → throw', async () => {
    mockRpcResult = { data: null, error: { message: 'insufficient activity_coins: have 10, need 30' } }
    await expect(pullGacha('s1')).rejects.toThrow(/insufficient activity_coins/)
  })

  it('빈 결과 → 에러', async () => {
    mockRpcResult = { data: [], error: null }
    await expect(pullGacha('s1')).rejects.toThrow(/비어 있습니다/)
  })
})

// ── 상수 ──────────────────────────────────────────────────────────────────────

describe('상수', () => {
  it('가챠 기본 비용 30', () => {
    expect(GACHA_COST).toBe(30)
  })
})
