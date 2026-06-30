import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// 학생 자가 등록 — 초대코드로 수업에 join.
// 미등록 학생은 RLS 상 classes 를 invite_code 로 조회할 수 없으므로(self_select 는 enrolled 전제)
// 코드 검증과 등록을 service-role(admin) 로 수행한다. student_id 는 인증된 본인으로 고정해 안전.

interface JoinInput {
  inviteCode: string
}

function parse(raw: unknown): JoinInput | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const code =
    typeof obj.inviteCode === 'string'
      ? obj.inviteCode.trim()
      : typeof obj.invite_code === 'string'
        ? (obj.invite_code as string).trim()
        : ''
  if (!code) return null
  return { inviteCode: code }
}

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const input = parse(body)
  if (!input) {
    return NextResponse.json({ error: '초대코드를 입력해 주세요.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1) 초대코드로 활성 수업 조회(대소문자 무시 정확 매칭).
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('id, name, is_active')
    .ilike('invite_code', input.inviteCode)
    .maybeSingle()

  if (clsErr) {
    console.error('[api/enrollments POST] class lookup', clsErr)
    return NextResponse.json({ error: '수업 조회에 실패했어요.' }, { status: 500 })
  }
  if (!cls) {
    return NextResponse.json(
      { error: '초대코드와 일치하는 수업이 없어요. 코드를 다시 확인해 주세요.' },
      { status: 404 }
    )
  }
  if ((cls as { is_active: boolean }).is_active === false) {
    return NextResponse.json({ error: '종료된 수업이에요.' }, { status: 409 })
  }

  const classId = (cls as { id: string }).id
  const className = (cls as { name: string }).name

  // 2) 이미 등록되어 있으면 멱등 처리.
  const { data: existing } = await admin
    .from('enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', auth.userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ classId, className, alreadyEnrolled: true })
  }

  // 3) 등록.
  const { error: insErr } = await admin
    .from('enrollments')
    .insert({ class_id: classId, student_id: auth.userId })

  if (insErr) {
    console.error('[api/enrollments POST] insert', insErr)
    return NextResponse.json({ error: '수업 등록에 실패했어요.' }, { status: 500 })
  }

  return NextResponse.json({ classId, className, alreadyEnrolled: false }, { status: 201 })
}
