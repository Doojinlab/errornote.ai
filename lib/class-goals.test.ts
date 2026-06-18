import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getClassGoals, contributeClassGoal } from './class-goals'

let mockSelectResult: { data: unknown; error: null | { message: string } } = { data: [], error: null }
let mockRpcResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }
const rpcSpy = vi.fn()

// 체이닝 가능 + awaitable 빌더
function builder(result: unknown) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'insert', 'update']) {
    b[m] = vi.fn(() => b)
  }
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej)
  return b
}

const mockSupabase = {
  from: vi.fn(() => builder(mockSelectResult)),
  rpc: vi.fn((fn: string, args: unknown) => {
    rpcSpy(fn, args)
    return Promise.resolve(mockRpcResult)
  })
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

function goalRow(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    class_id: 'c1',
    species_id: 'sp1',
    title: '把자문 정복',
    target_count: 30,
    current_count: 12,
    period_start: '2026-06-15',
    period_end: '2026-06-21',
    achieved: false,
    ...over
  }
}

beforeEach(() => {
  mockSelectResult = { data: [], error: null }
  mockRpcResult = { data: null, error: null }
  rpcSpy.mockClear()
})

describe('getClassGoals()', () => {
  it('snake → camel 매핑', async () => {
    mockSelectResult = { data: [goalRow()], error: null }
    const goals = await getClassGoals('c1')
    expect(goals[0]).toMatchObject({
      id: 'g1',
      classId: 'c1',
      speciesId: 'sp1',
      targetCount: 30,
      currentCount: 12,
      achieved: false
    })
  })

  it('에러 → throw', async () => {
    mockSelectResult = { data: null, error: { message: 'boom' } }
    await expect(getClassGoals('c1')).rejects.toThrow(/boom/)
  })
})

describe('contributeClassGoal()', () => {
  it('RPC 결과 매핑 + 인자 전달', async () => {
    mockRpcResult = { data: [{ current_count: 13, target_count: 30, achieved: false }], error: null }
    const res = await contributeClassGoal('c1', 'ba_construction')
    expect(res).toEqual({ currentCount: 13, targetCount: 30, achieved: false })
    expect(rpcSpy).toHaveBeenCalledWith('contribute_class_goal', {
      p_class_id: 'c1',
      p_code: 'ba_construction'
    })
  })

  it('활성 목표 없음(no-op) 결과도 그대로', async () => {
    mockRpcResult = { data: [{ current_count: 0, target_count: 0, achieved: false }], error: null }
    const res = await contributeClassGoal('c1', 'word_order')
    expect(res).toEqual({ currentCount: 0, targetCount: 0, achieved: false })
  })

  it('빈 결과 → 에러', async () => {
    mockRpcResult = { data: [], error: null }
    await expect(contributeClassGoal('c1', 'x')).rejects.toThrow(/비어 있습니다/)
  })
})
