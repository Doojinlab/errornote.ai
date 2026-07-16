import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getHotwordByCategory } from '@/lib/hotwords'
import type { HotwordCategory } from '@/types/hotwords'

export const runtime = 'nodejs'

const VALID: ReadonlySet<HotwordCategory> = new Set<HotwordCategory>([
  'game',
  'entertainment',
  'society',
  'economy',
  'daily',
  'meme',
])

// 今日热词 — 카테고리별 단어 1개 조회(B-1 선택 / B-4 새로고침).
// GET /api/hotwords/by-category?category=game&exclude=id1,id2
export async function GET(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const url = new URL(req.url)
  const category = url.searchParams.get('category') as HotwordCategory | null
  if (!category || !VALID.has(category)) {
    return NextResponse.json({ error: '유효하지 않은 category' }, { status: 400 })
  }
  const exclude = (url.searchParams.get('exclude') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    const hotword = await getHotwordByCategory(auth.userId, category, exclude)
    return NextResponse.json({ hotword })
  } catch (err) {
    console.error('[api/hotwords/by-category]', err)
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }
}
