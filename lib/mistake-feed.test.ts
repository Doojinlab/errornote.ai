import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  submitMistake,
  getMyMistakes,
  setMistakePublic,
  getPublicFeed
} from './mistake-feed'
import { anonNickname } from './anon'

let mockResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }
let mockRpcResult: { data: unknown; error: null | { message: string } } = { data: null, error: null }
const insertSpy = vi.fn()
const updateSpy = vi.fn()
const rpcSpy = vi.fn()

function builder(result: () => { data: unknown; error: null | { message: string } }) {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.order = vi.fn(() => b)
  b.insert = vi.fn((v: unknown) => {
    insertSpy(v)
    return b
  })
  b.update = vi.fn((v: unknown) => {
    updateSpy(v)
    return b
  })
  b.single = vi.fn(() => Promise.resolve(result()))
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(res, rej)
  return b
}

const mockSupabase = {
  from: vi.fn(() => builder(() => mockResult)),
  rpc: vi.fn((fn: string, args: unknown) => {
    rpcSpy(fn, args)
    return Promise.resolve(mockRpcResult)
  })
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase
}))

beforeEach(() => {
  mockResult = { data: null, error: null }
  mockRpcResult = { data: null, error: null }
  insertSpy.mockClear()
  updateSpy.mockClear()
  rpcSpy.mockClear()
})

describe('submitMistake()', () => {
  it('기본 비공개로 등록하고 id 반환', async () => {
    mockResult = { data: { id: 'm1' }, error: null }
    const id = await submitMistake('s1', { originalKo: '컴맹', literalZh: '电脑盲' })
    expect(id).toBe('m1')
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: 's1', is_public: false, corrected_zh: '' })
    )
  })

  it('opt-in(is_public=true) 명시 가능', async () => {
    mockResult = { data: { id: 'm2' }, error: null }
    await submitMistake('s1', { originalKo: 'x', literalZh: 'y', isPublic: true })
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ is_public: true }))
  })

  it('에러 → throw', async () => {
    mockResult = { data: null, error: { message: 'boom' } }
    await expect(submitMistake('s1', { originalKo: 'x', literalZh: 'y' })).rejects.toThrow(/boom/)
  })
})

describe('getMyMistakes()', () => {
  it('snake → camel 매핑', async () => {
    mockResult = {
      data: [
        {
          id: 'm1',
          original_ko: '컴맹',
          literal_zh: '电脑盲',
          corrected_zh: '电脑白痴',
          is_public: false,
          likes: 0,
          created_at: '2026-06-20T00:00:00Z'
        }
      ],
      error: null
    }
    const rows = await getMyMistakes('s1')
    expect(rows[0]).toMatchObject({ id: 'm1', originalKo: '컴맹', literalZh: '电脑盲', isPublic: false })
  })
})

describe('setMistakePublic()', () => {
  it('is_public 토글 업데이트', async () => {
    mockResult = { data: null, error: null }
    await setMistakePublic('s1', 'm1', true)
    expect(updateSpy).toHaveBeenCalledWith({ is_public: true })
  })

  it('에러 → throw', async () => {
    mockResult = { data: null, error: { message: 'nope' } }
    await expect(setMistakePublic('s1', 'm1', false)).rejects.toThrow(/nope/)
  })
})

describe('getPublicFeed()', () => {
  it('익명 시드→닉네임 매핑, student_id 미노출', async () => {
    mockRpcResult = {
      data: [
        {
          id: 'm1',
          original_ko: '컴맹',
          literal_zh: '电脑盲',
          corrected_zh: '电脑白痴',
          likes: 3,
          anon_seed: 'aaaa1111',
          is_me: false,
          created_at: '2026-06-20T00:00:00Z'
        }
      ],
      error: null
    }
    const rows = await getPublicFeed(10)
    expect(rows[0]).toMatchObject({
      id: 'm1',
      originalKo: '컴맹',
      nickname: anonNickname('aaaa1111'),
      isMe: false
    })
    expect(rpcSpy).toHaveBeenCalledWith('get_public_mistake_feed', { p_limit: 10 })
    expect(JSON.stringify(rows)).not.toContain('student_id')
  })
})
