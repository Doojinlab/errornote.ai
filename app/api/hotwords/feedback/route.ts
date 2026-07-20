import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { recordVote } from '@/lib/hotwords'
import type { HotwordVote } from '@/types/hotwords'

export const runtime = 'nodejs'

// 今日热词 좋았어요/비추 (docs/dashboard-features.md §2.5)
// 입장하기(학습)와 별개로, 자동 큐레이션(콘텐츠 수명 조절)용 신호다.
// 1인 1표는 unique 제약 + upsert 로 보장하고, 집계·비율 판정은 lib/hotwords 가 수행.
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
  const vote = obj.vote
  if (!hotwordId) {
    return NextResponse.json({ error: 'hotwordId 는 필수입니다' }, { status: 400 })
  }
  if (vote !== 'like' && vote !== 'dislike') {
    return NextResponse.json({ error: "vote 는 'like' 또는 'dislike' 여야 합니다" }, { status: 400 })
  }

  try {
    const result = await recordVote(auth.userId, hotwordId, vote as HotwordVote)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/hotwords/feedback POST]', err)
    return NextResponse.json({ error: '피드백 저장 실패' }, { status: 500 })
  }
}
