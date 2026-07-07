import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  listMarketplace,
  getMarketplaceDetail,
  downloadMarketplaceDoc,
  upsertRating,
  listMyCorpus,
  updatePublishState,
} from './marketplace'

// ── Supabase 모의 ─────────────────────────────────────────────────────────────
interface QueryShape {
  table: string
  op: 'select' | 'update' | 'upsert'
  single: boolean
  filters: Array<[string, string, unknown]>
  payload?: unknown
}
type QueryResult = { data?: unknown; error?: unknown; count?: number }

let handleQuery: (q: QueryShape) => QueryResult = () => ({ data: null, error: null })
let rpcImpl: (fn: string, args: unknown) => QueryResult = () => ({ data: 0, error: null })

function makeBuilder(table: string) {
  const q: QueryShape = { table, op: 'select', single: false, filters: [] }
  const b: Record<string, unknown> = {
    select: () => b,
    update: (payload: unknown) => {
      q.op = 'update'
      q.payload = payload
      return b
    },
    upsert: (payload: unknown) => {
      q.op = 'upsert'
      q.payload = payload
      return Promise.resolve(handleQuery(q))
    },
    eq: (c: string, v: unknown) => {
      q.filters.push(['eq', c, v])
      return b
    },
    or: (expr: string) => {
      q.filters.push(['or', expr, null])
      return b
    },
    order: () => b,
    limit: () => b,
    maybeSingle: () => {
      q.single = true
      return Promise.resolve(handleQuery(q))
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(handleQuery(q)).then(resolve, reject),
  }
  return b
}

const mockSupabase = {
  from: (table: string) => makeBuilder(table),
  rpc: (fn: string, args: unknown) => Promise.resolve(rpcImpl(fn, args)),
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase,
  createAdminClient: () => mockSupabase,
}))

const docRow = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: '작문 코퍼스',
  description: '설명',
  file_name: 'corpus.txt',
  file_type: 'txt',
  download_count: 10,
  rating_count: 4,
  avg_rating: '4.5',
  created_at: '2026-06-01T00:00:00Z',
  ...over,
})

beforeEach(() => {
  handleQuery = () => ({ data: null, error: null })
  rpcImpl = () => ({ data: 0, error: null })
})

describe('listMarketplace', () => {
  it('maps rows to items, coercing avg_rating and falling back title to file_name', async () => {
    handleQuery = () => ({
      data: [docRow(), docRow({ id: 'd2', title: null, avg_rating: 'nan' })],
      count: 2,
      error: null,
    })
    const res = await listMarketplace(undefined, 'new')
    expect(res.total).toBe(2)
    expect(res.items[0].avg_rating).toBe(4.5)
    expect(res.items[1].title).toBe('corpus.txt') // title null → file_name
    expect(res.items[1].avg_rating).toBe(0) // 파싱 실패 → 0
  })

  it('adds an OR search filter when a query term is present', async () => {
    let filters: QueryShape['filters'] = []
    handleQuery = (q) => {
      filters = q.filters
      return { data: [], count: 0, error: null }
    }
    await listMarketplace('  도서관  ', 'rating')
    const or = filters.find((f) => f[0] === 'or')
    expect(or).toBeDefined()
    expect(String(or?.[1])).toContain('도서관')
  })

  it('falls back total to the row count when count is null', async () => {
    handleQuery = () => ({ data: [docRow()], count: undefined, error: null })
    const res = await listMarketplace(undefined, 'downloads')
    expect(res.total).toBe(1)
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'boom' } })
    await expect(listMarketplace(undefined, 'new')).rejects.toThrow(/marketplace 목록 조회 실패/)
  })
})

describe('getMarketplaceDetail', () => {
  it('assembles preview, char length, my rating and recent ratings', async () => {
    handleQuery = (q) => {
      if (q.table === 'corpus_documents')
        return { data: { ...docRow(), content: 'x'.repeat(1000), is_public: true }, error: null }
      if (q.table === 'corpus_ratings' && !q.single)
        return { data: [{ id: 'rt1', rating: 5, comment: '좋아요', created_at: '2026-06-02T00:00:00Z' }], error: null }
      if (q.table === 'corpus_ratings' && q.single) return { data: { rating: 3 }, error: null }
      return { data: null, error: null }
    }
    const detail = await getMarketplaceDetail('d1', 'viewer1')
    expect(detail).not.toBeNull()
    expect(detail!.preview).toHaveLength(600) // PREVIEW_CHARS
    expect(detail!.char_length).toBe(1000)
    expect(detail!.my_rating).toBe(3)
    expect(detail!.recent_ratings).toHaveLength(1)
  })

  it('returns null when the document is missing', async () => {
    handleQuery = (q) => (q.table === 'corpus_documents' ? { data: null, error: null } : { data: null, error: null })
    expect(await getMarketplaceDetail('missing', 'v1')).toBeNull()
  })

  it('throws when the document query errors', async () => {
    handleQuery = (q) =>
      q.table === 'corpus_documents' ? { data: null, error: { message: 'boom' } } : { data: null, error: null }
    await expect(getMarketplaceDetail('d1', 'v1')).rejects.toThrow(/상세 조회 실패/)
  })
})

describe('downloadMarketplaceDoc', () => {
  it('returns file content and the new download count from the RPC', async () => {
    handleQuery = (q) =>
      q.table === 'corpus_documents'
        ? { data: { id: 'd1', file_name: 'corpus.txt', file_type: 'txt', content: '내용', is_public: true }, error: null }
        : { data: null, error: null }
    rpcImpl = (fn) => (fn === 'increment_corpus_download' ? { data: 11, error: null } : { data: null, error: null })
    const res = await downloadMarketplaceDoc('d1')
    expect(res).toEqual({ fileName: 'corpus.txt', fileType: 'txt', content: '내용', newCount: 11 })
  })

  it('returns null when the doc is not found', async () => {
    handleQuery = () => ({ data: null, error: null })
    expect(await downloadMarketplaceDoc('x')).toBeNull()
  })

  it('throws when the RPC fails', async () => {
    handleQuery = (q) =>
      q.table === 'corpus_documents'
        ? { data: { file_name: 'f', file_type: 'txt', content: 'c', is_public: true }, error: null }
        : { data: null, error: null }
    rpcImpl = () => ({ data: null, error: { message: 'rpc boom' } })
    await expect(downloadMarketplaceDoc('d1')).rejects.toThrow(/download_count 증가 실패/)
  })
})

describe('upsertRating', () => {
  it('rejects out-of-range ratings before any query', async () => {
    await expect(upsertRating('d1', 'p2', 0, undefined)).rejects.toThrow(/1~5/)
    await expect(upsertRating('d1', 'p2', 6, undefined)).rejects.toThrow(/1~5/)
    await expect(upsertRating('d1', 'p2', 3.5, undefined)).rejects.toThrow(/1~5/)
  })

  it('rejects rating your own document', async () => {
    handleQuery = (q) =>
      q.table === 'corpus_documents' && q.single
        ? { data: { professor_id: 'p1', is_public: true }, error: null }
        : { data: null, error: null }
    await expect(upsertRating('d1', 'p1', 5, undefined)).rejects.toThrow(/본인 업로드/)
  })

  it('rejects rating a non-public document', async () => {
    handleQuery = (q) =>
      q.table === 'corpus_documents' && q.single
        ? { data: { professor_id: 'p1', is_public: false }, error: null }
        : { data: null, error: null }
    await expect(upsertRating('d1', 'p2', 5, undefined)).rejects.toThrow(/공개되지 않은/)
  })

  it('rejects a missing document', async () => {
    handleQuery = () => ({ data: null, error: null })
    await expect(upsertRating('d1', 'p2', 5, undefined)).rejects.toThrow(/존재하지 않는/)
  })

  it('upserts and returns the refreshed aggregate', async () => {
    let upsertPayload: Record<string, unknown> | undefined
    let sawUpsert = false
    handleQuery = (q) => {
      if (q.table === 'corpus_documents' && q.op === 'select') {
        // 첫 호출: 소유권 체크 / 둘째 호출: 집계 재조회 — filters 로는 구분 안 되나 둘 다 만족하는 값 반환
        return { data: { professor_id: 'p1', is_public: true, avg_rating: '4.2', rating_count: 5 }, error: null }
      }
      if (q.table === 'corpus_ratings' && q.op === 'upsert') {
        sawUpsert = true
        upsertPayload = q.payload as Record<string, unknown>
        return { error: null }
      }
      return { data: null, error: null }
    }
    const res = await upsertRating('d1', 'p2', 4, '  좋아요  ')
    expect(sawUpsert).toBe(true)
    expect(upsertPayload).toMatchObject({ corpus_document_id: 'd1', professor_id: 'p2', rating: 4, comment: '좋아요' })
    expect(res).toEqual({ avg_rating: 4.2, rating_count: 5 })
  })

  it('throws when the upsert fails', async () => {
    handleQuery = (q) => {
      if (q.table === 'corpus_documents') return { data: { professor_id: 'p1', is_public: true, avg_rating: '4', rating_count: 1 }, error: null }
      if (q.op === 'upsert') return { error: { message: 'boom' } }
      return { data: null, error: null }
    }
    await expect(upsertRating('d1', 'p2', 4, undefined)).rejects.toThrow(/평점 저장 실패/)
  })
})

describe('listMyCorpus', () => {
  it('maps rows and resolves the class name from an object or array join', async () => {
    handleQuery = () => ({
      data: [
        { id: 'd1', class_id: 'c1', file_name: 'a.txt', title: '제목', description: null, is_public: true, download_count: 2, rating_count: 1, avg_rating: '3', classes: { name: '중급 작문' } },
        { id: 'd2', class_id: 'c2', file_name: 'b.txt', title: null, description: null, is_public: false, download_count: 0, rating_count: 0, avg_rating: 'x', classes: [{ name: '고급 작문' }] },
        { id: 'd3', class_id: 'c3', file_name: 'c.txt', title: null, description: null, is_public: false, download_count: 0, rating_count: 0, avg_rating: '0', classes: null },
      ],
      error: null,
    })
    const list = await listMyCorpus('p1')
    expect(list[0].class_name).toBe('중급 작문')
    expect(list[1].class_name).toBe('고급 작문') // 배열 조인
    expect(list[1].title).toBe('b.txt') // title null → file_name
    expect(list[1].avg_rating).toBe(0)
    expect(list[2].class_name).toBe('(수업 없음)') // null 조인
  })

  it('throws on error', async () => {
    handleQuery = () => ({ data: null, error: { message: 'boom' } })
    await expect(listMyCorpus('p1')).rejects.toThrow(/내 코퍼스 조회 실패/)
  })
})

describe('updatePublishState', () => {
  it('builds a patch with trimmed title/description and normalizes blanks to null', async () => {
    let payload: Record<string, unknown> | undefined
    handleQuery = (q) => {
      payload = q.payload as Record<string, unknown>
      return { error: null }
    }
    await updatePublishState('p1', { id: 'd1', is_public: true, title: '  새 제목  ', description: '   ' })
    expect(payload).toEqual({ is_public: true, title: '새 제목', description: null })
  })

  it('omits title/description when not provided', async () => {
    let payload: Record<string, unknown> | undefined
    handleQuery = (q) => {
      payload = q.payload as Record<string, unknown>
      return { error: null }
    }
    await updatePublishState('p1', { id: 'd1', is_public: false })
    expect(payload).toEqual({ is_public: false })
  })

  it('throws on error', async () => {
    handleQuery = () => ({ error: { message: 'boom' } })
    await expect(updatePublishState('p1', { id: 'd1', is_public: true })).rejects.toThrow(/공개 상태 업데이트 실패/)
  })
})
