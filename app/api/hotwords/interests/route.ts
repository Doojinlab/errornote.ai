import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getInterests, setInterests, HOTWORD_CATEGORY_LABEL } from '@/lib/hotwords'
import type { HotwordCategory } from '@/types/hotwords'

export const runtime = 'nodejs'

const VALID = Object.keys(HOTWORD_CATEGORY_LABEL) as HotwordCategory[]

async function auth() {
  return requireAuth('student')
}

// 今日热词 관심분야 조회/저장 (docs/dashboard-features.md §2.1)
export async function GET() {
  try {
    const { userId } = await auth()
    const categories = await getInterests(userId)
    return NextResponse.json({ categories })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '관심분야 조회 실패' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  let userId: string
  try {
    userId = (await auth()).userId
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const raw = (body as { categories?: unknown })?.categories
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: 'categories 배열이 필요합니다' }, { status: 400 })
  }
  const categories = raw.filter(
    (c): c is HotwordCategory => typeof c === 'string' && (VALID as string[]).includes(c),
  )

  try {
    await setInterests(userId, categories)
    return NextResponse.json({ categories })
  } catch (err) {
    console.error('[api/hotwords/interests PUT]', err)
    return NextResponse.json({ error: '관심분야 저장 실패' }, { status: 500 })
  }
}
