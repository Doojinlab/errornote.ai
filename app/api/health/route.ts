import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkServerEnv } from '@/lib/env'

/**
 * 헬스체크 엔드포인트 — 운영 배포 직후 "제대로 떴는지" 5분 안에 확인하는 용도.
 *
 * GET /api/health → { status, db, env, time }
 * - status: 'ok' (env 충족 + DB 연결) | 'degraded' (둘 중 하나라도 실패)
 * - db: 'ok' | 'fail'  (가벼운 head 쿼리 1개로 연결만 확인)
 * - env: { ok, missing }  (누락 env 는 **이름**만 — 시크릿 값 노출 금지)
 * - time: ISO 타임스탬프
 *
 * 보안: 어떤 시크릿 값도, 데이터 행/카운트도 응답에 싣지 않는다.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const env = checkServerEnv()

  let db: 'ok' | 'fail' = 'fail'
  try {
    const supabase = createServerClient()
    // 가장 가벼운 연결 확인: head 요청(행 본문 없음). 카운트조차 응답에 싣지 않는다.
    const { error } = await supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
    db = error ? 'fail' : 'ok'
  } catch {
    db = 'fail'
  }

  const status = env.ok && db === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json(
    { status, db, env, time: new Date().toISOString() },
    { status: status === 'ok' ? 200 : 503 }
  )
}
