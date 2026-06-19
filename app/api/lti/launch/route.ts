import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  extractLaunchContext,
  validateLaunchClaims,
  verifyIdToken,
  type LtiPlatform,
} from '@/lib/lti'

// LTI 1.3 런치(§5.1.3). 플랫폼이 form_post 로 id_token + state 를 보낸다.
//   1) state 를 소비(1회용)하고 nonce/issuer 를 회수
//   2) id_token 서명을 플랫폼 JWKS 로 검증(jose) + iss/aud/exp
//   3) nonce/필수 LTI 클레임 검증
//   4) 런치 컨텍스트 추출 후 앱으로 진입
//
// 후속(#47): LTI sub → errornote 사용자 매핑/프로비저닝(NRPS), 세션 수립,
//            context → class 연결, AGS 점수 회신, Deep Linking 응답.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const form = await req.formData()
  const idToken = String(form.get('id_token') ?? '')
  const state = String(form.get('state') ?? '')
  if (!idToken || !state) {
    return NextResponse.json({ error: 'missing id_token / state' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1) state 소비 — 존재 확인 후 즉시 삭제(재사용 방지)
  const { data: stateRow, error: stErr } = await supabase
    .from('lti_login_states')
    .select('nonce, issuer')
    .eq('state', state)
    .maybeSingle()
  if (stErr || !stateRow) {
    return NextResponse.json({ error: 'invalid or expired state' }, { status: 400 })
  }
  await supabase.from('lti_login_states').delete().eq('state', state)
  const { nonce, issuer } = stateRow as unknown as { nonce: string; issuer: string }

  // 2) 플랫폼 조회
  const { data: pf } = await supabase
    .from('lti_platforms')
    .select('*')
    .eq('issuer', issuer)
    .limit(1)
    .maybeSingle()
  if (!pf) {
    return NextResponse.json({ error: 'unknown LTI platform' }, { status: 404 })
  }
  const platform = pf as unknown as LtiPlatform

  // 3) 서명 검증
  let claims
  try {
    claims = await verifyIdToken(idToken, platform)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `id_token verification failed: ${msg}` }, { status: 401 })
  }

  // 4) nonce/필수 클레임 검증
  const violation = validateLaunchClaims(claims, {
    issuer,
    nonce,
    deploymentId: platform.deployment_id,
  })
  if (violation) {
    return NextResponse.json({ error: violation }, { status: 401 })
  }

  // 5) 런치 컨텍스트 추출 → 앱 진입(프로비저닝은 후속)
  const ctx = extractLaunchContext(claims)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const dest = ctx.isInstructor ? '/ko/dashboard' : '/ko/learn'
  return NextResponse.redirect(new URL(dest, appUrl), 302)
}
