import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ctx = { params: Promise<{ id: string }> }

/** DELETE: 반 협동 목표 삭제(교수). RLS(owns_class) 로 소유 수업만 삭제된다. */
export async function DELETE(_req: Request, props: Ctx) {
  try {
    await requireAuth('professor')
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

  const supabase = createServerClient() as unknown as SupabaseClient<Database>
  const { error, count } = await supabase
    .from('class_goals')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) {
    console.error('[api/class-goals DELETE]', error)
    return NextResponse.json({ error: '목표 삭제 실패' }, { status: 500 })
  }
  // RLS(owns_class) 로 차단됐거나 존재하지 않으면 0건 — 항상 success 로 가리지 않는다.
  if (!count) {
    return NextResponse.json({ error: '목표를 찾을 수 없습니다' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
