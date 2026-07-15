import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { generateHskListening } from '@/lib/hsk-listening'
import { isHskLevel } from '@/lib/hsk'
import type { HskListeningGenerateResponse } from '@/types/hsk'

export const runtime = 'nodejs'
export const maxDuration = 60

// 실전 HSK 듣기 문제 생성 — 기출 유형 기반 AI 대본 1개.
// 대본(audioScript)은 클라이언트가 /api/hsk/tts 로 음성 합성해 재생한다.
export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }
  void auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const level = Number((body as { level?: unknown })?.level)
  if (!isHskLevel(level)) {
    return NextResponse.json({ error: 'level(3~6)이 유효하지 않습니다' }, { status: 400 })
  }

  try {
    const question = await generateHskListening(level)
    const res: HskListeningGenerateResponse = { question }
    return NextResponse.json(res)
  } catch (err) {
    console.error('[api/hsk/listening/generate]', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API 오류: ${err.message}` }, { status: err.status ?? 500 })
    }
    return NextResponse.json({ error: 'HSK 듣기 문제 생성 실패' }, { status: 500 })
  }
}
