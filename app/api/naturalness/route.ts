import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { askNaturalness } from '@/lib/quick-ask'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_LEN = 500

// "이거 자연스러워?" 퀵애스크 (M10) — 문장 자연스러움 즉답.
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

  const raw = (body as { text?: unknown })?.text
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) {
    return NextResponse.json({ error: '문장을 입력해주세요' }, { status: 400 })
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: `문장은 ${MAX_LEN}자 이하여야 합니다` }, { status: 400 })
  }

  try {
    const result = await askNaturalness(text)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/naturalness]', err)
    return NextResponse.json({ error: '자연스러움 분석 실패' }, { status: 500 })
  }
}
