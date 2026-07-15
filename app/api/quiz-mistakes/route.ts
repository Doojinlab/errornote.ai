import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { normalizeQuizMistake, recordQuizMistake } from '@/lib/quiz-mistakes'

export const runtime = 'nodejs'

// 튜터 연습 퀴즈 오답 저장. 클라이언트(QuizModal)가 오답 발생 시 문항 스냅샷을 POST 한다.
// 오답이 아니거나(선택=정답) 형식이 잘못되면 200 + recorded:false 로 조용히 무시한다
// (학습 흐름을 막지 않기 위함 — 비치명적 사이드 이펙트).
export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('student')
    const input = normalizeQuizMistake(body)
    if (!input) {
      return NextResponse.json({ recorded: false })
    }
    const recorded = await recordQuizMistake(auth.userId, input)
    return NextResponse.json({ recorded })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/quiz-mistakes] error:', err)
    const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
