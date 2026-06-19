import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { submitMistake } from '@/lib/mistake-feed'

export const runtime = 'nodejs'

const MAX_LEN = 500

function authErr(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
  return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * POST: 직역 명문장 등록. **기본 비공개** — isPublic 은 명시 동의 시에만 true.
 * body: { originalKo, literalZh, correctedZh?, isPublic? }
 */
export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    return authErr(err)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }
  const o = (body ?? {}) as Record<string, unknown>
  const originalKo = str(o.originalKo).slice(0, MAX_LEN)
  const literalZh = str(o.literalZh).slice(0, MAX_LEN)
  const correctedZh = str(o.correctedZh).slice(0, MAX_LEN)
  if (!originalKo || !literalZh) {
    return NextResponse.json({ error: '한국어 원문과 직역(중국어)은 필수입니다' }, { status: 400 })
  }

  try {
    const id = await submitMistake(auth.userId, {
      originalKo,
      literalZh,
      correctedZh: correctedZh || undefined,
      isPublic: o.isPublic === true,
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[api/mistake-feed POST]', err)
    return NextResponse.json({ error: '등록에 실패했습니다' }, { status: 500 })
  }
}
