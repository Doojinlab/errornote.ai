import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { generateCustomHotword } from '@/lib/hotword-custom'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_TOPIC = 40

// 今日热词 "직접 입력" — 관심 주제로 요즘 표현 1개를 즉석 생성(B-1). 풀 미저장.
export async function POST(req: Request) {
  try {
    await requireAuth('student')
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

  const topic = typeof (body as { topic?: unknown })?.topic === 'string'
    ? (body as { topic: string }).topic.trim()
    : ''
  if (!topic) {
    return NextResponse.json({ error: 'topic 은 필수입니다' }, { status: 400 })
  }
  if (topic.length > MAX_TOPIC) {
    return NextResponse.json({ error: `topic 은 최대 ${MAX_TOPIC}자입니다` }, { status: 400 })
  }

  try {
    const hotword = await generateCustomHotword(topic)
    return NextResponse.json({ hotword })
  } catch (err) {
    console.error('[api/hotwords/custom]', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API 오류: ${err.message}` }, { status: err.status ?? 500 })
    }
    return NextResponse.json({ error: '표현 생성 실패' }, { status: 500 })
  }
}
