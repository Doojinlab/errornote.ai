import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { setMistakePublic } from '@/lib/mistake-feed'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }

/** PATCH: 공개(opt-in) 토글. 본인 항목만(RLS 보장). body: { isPublic: boolean } */
export async function PATCH(req: Request, props: Ctx) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const { id } = await props.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id 가 유효하지 않습니다' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }
  const isPublic = (body as { isPublic?: unknown })?.isPublic
  if (typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'isPublic(boolean)이 필요합니다' }, { status: 400 })
  }

  try {
    await setMistakePublic(auth.userId, id, isPublic)
    return NextResponse.json({ id, isPublic })
  } catch (err) {
    console.error('[api/mistake-feed PATCH]', err)
    return NextResponse.json({ error: '공개 설정에 실패했습니다' }, { status: 500 })
  }
}
