import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }

/** DELETE: 본인이 등록한 플랫폼 삭제. professor_id 일치 행만 삭제(타인 등록 보호). */
export async function DELETE(_req: Request, props: Ctx) {
  let auth
  try {
    auth = await requireAuth('professor')
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

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('lti_platforms')
    .delete()
    .eq('id', id)
    .eq('professor_id', auth.userId)

  if (error) {
    console.error('[api/lti/platforms DELETE]', error)
    return NextResponse.json({ error: '플랫폼 삭제 실패' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
