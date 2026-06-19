// POST /api/notifications/inbox/read — 알림 읽음 처리.
// body: { id: string } — 단건 / { ids: string[] } — 다건 / { all: true } — 본인 미읽음 전체
// [창] feat/phase4-weekly-report

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

// @supabase/ssr@0.5 의 클라이언트 타입은 supabase-js@2.105 의 신 제네릭 시그니처와
// 어긋나 `.from(...).update(...)` 가 never 로 추론된다. 런타임은 동일하므로
// 신 시그니처 타입으로 좁혀서 사용한다(스키마 제네릭은 느슨히).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = SupabaseClient<Database, any, any, any>

interface ReadBody {
  id?: unknown
  ids?: unknown
  all?: unknown
}

export async function POST(req: Request) {
  let body: ReadBody
  try {
    body = (await req.json()) as ReadBody
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  try {
    const auth = await requireAuth()
    const supabase = createServerClient() as unknown as DbClient
    const now = new Date().toISOString()

    if (body.all === true) {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .update({ read_at: now })
        .eq('user_id', auth.userId)
        .is('read_at', null)
        .select('id')
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, marked: (data ?? []).length })
    }

    const ids: string[] = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string')
      : typeof body.id === 'string'
      ? [body.id]
      : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'id 또는 ids 필요' }, { status: 400 })
    }
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: now })
      .in('id', ids)
      // RLS 가 본인 행만 허용하지만 안전을 위해 한 번 더.
      .eq('user_id', auth.userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, marked: ids.length })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
