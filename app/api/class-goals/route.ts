import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

// class_goals 쓰기는 RLS(owns_class) 로 보호된다. createServerClient(세션 토큰)로 호출하면
// 본인 소유 수업이 아닌 경우 insert 가 정책에 막힌다 — 라우트는 입력 검증만 담당.
function db(): SupabaseClient<Database> {
  return createServerClient() as unknown as SupabaseClient<Database>
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function authErr(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
  return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
}

/** POST: 반 협동 목표 생성(교수). body: { classId, speciesCode, title?, targetCount, periodStart, periodEnd } */
export async function POST(req: Request) {
  try {
    await requireAuth('professor')
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
  const classId = typeof o.classId === 'string' ? o.classId : ''
  const speciesCode = typeof o.speciesCode === 'string' ? o.speciesCode : ''
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 120) : ''
  const targetCount = Number(o.targetCount)
  const periodStart = typeof o.periodStart === 'string' ? o.periodStart : ''
  const periodEnd = typeof o.periodEnd === 'string' ? o.periodEnd : ''

  if (!classId || !speciesCode) {
    return NextResponse.json({ error: 'classId 와 speciesCode 는 필수입니다' }, { status: 400 })
  }
  if (!Number.isInteger(targetCount) || targetCount <= 0) {
    return NextResponse.json({ error: 'targetCount 는 1 이상의 정수여야 합니다' }, { status: 400 })
  }
  if (!YMD_RE.test(periodStart) || !YMD_RE.test(periodEnd) || periodEnd < periodStart) {
    return NextResponse.json({ error: '기간(periodStart~periodEnd)이 유효하지 않습니다' }, { status: 400 })
  }

  const supabase = db()
  const { data: species, error: spErr } = await supabase
    .from('error_species')
    .select('id')
    .eq('code', speciesCode)
    .maybeSingle()
  if (spErr || !species) {
    return NextResponse.json({ error: '알 수 없는 오류 유형(speciesCode)입니다' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('class_goals')
    .insert({
      class_id: classId,
      species_id: (species as { id: string }).id,
      title,
      target_count: targetCount,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select('id, class_id, species_id, title, target_count, current_count, period_start, period_end, achieved')
    .single()

  if (error) {
    // RLS(owns_class) 위반이면 행이 안 만들어진다 → 권한 또는 입력 문제.
    console.error('[api/class-goals POST]', error)
    return NextResponse.json({ error: '목표 생성 실패(수업 소유자만 가능)' }, { status: 403 })
  }
  return NextResponse.json({ goal: data }, { status: 201 })
}
