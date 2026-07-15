import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { askNaturalness, type NaturalnessResult } from '@/lib/quick-ask'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_TEXT_LENGTH = 300

// "이거 자연스러워?" 퀵애스크 — gamification-spec M10.
// 학습자가 쓴 중국어 문장의 자연스러움을 AI 가 즉답한다. 상태 저장 없음(가벼운 유틸).
export async function POST(req: Request): Promise<Response> {
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
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const text = typeof (body as { text?: unknown })?.text === 'string'
    ? (body as { text: string }).text.trim()
    : ''
  if (!text) {
    return NextResponse.json({ error: 'text 는 필수입니다' }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text 는 최대 ${MAX_TEXT_LENGTH}자까지 지원합니다` },
      { status: 400 }
    )
  }

  let result: NaturalnessResult
  try {
    result = await askNaturalness(text)
  } catch (err) {
    console.error('[api/quick-ask] error:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'Claude API 인증 실패. 관리자에게 문의하세요.' },
        { status: 500 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '확인 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json(result)
}
