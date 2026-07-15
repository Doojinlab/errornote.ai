import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { recordImpression } from '@/lib/hotwords'

export const runtime = 'nodejs'

// 今日热词 고유 노출 집계 (docs/dashboard-features.md §2.5)
// like_rate 분모를 정직하게 만들기 위해 학생×카드 1회만 집계한다(멱등).
export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
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

  const obj = (body ?? {}) as Record<string, unknown>
  const hotwordId = typeof obj.hotwordId === 'string' ? obj.hotwordId.trim() : ''
  if (!hotwordId) {
    return NextResponse.json({ error: 'hotwordId 는 필수입니다' }, { status: 400 })
  }

  try {
    await recordImpression(auth.userId, hotwordId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/hotwords/impression POST]', err)
    return NextResponse.json({ error: '노출 집계 실패' }, { status: 500 })
  }
}
