import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// 기능 출시 알림 대기자 신청 (docs/dashboard-features.md §1.2)
// 예: 실전 HSK "말하기(곧)" 출시 알림 신청. 1인 1신청(unique).
const ALLOWED = new Set(['hsk_speaking'])

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

  const feature = (body as { feature?: unknown })?.feature
  if (typeof feature !== 'string' || !ALLOWED.has(feature)) {
    return NextResponse.json({ error: '지원하지 않는 feature 입니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('feature_waitlist')
    .upsert(
      { student_id: auth.userId, feature },
      { onConflict: 'student_id,feature', ignoreDuplicates: true },
    )
  if (error) {
    console.error('[api/waitlist]', error)
    return NextResponse.json({ error: '신청 저장 실패' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
