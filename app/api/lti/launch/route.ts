import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  LTI,
  MSG_DEEP_LINKING,
  extractLaunchContext,
  validateLaunchClaims,
  verifyIdToken,
  type LtiPlatform,
} from '@/lib/lti'
import { resolveOrProvisionIdentity } from '@/lib/lti-provisioning'
import { resolveClassForContext, ensureEnrollment } from '@/lib/lti-context'
import { parseDeepLinkingSettings, buildSelectionPage } from '@/lib/lti-deep-linking'
import { mintDeepLinkToken, dlTokenSecret } from '@/lib/lti-dl-token'
import { SUPPORTED_CHAPTERS } from '@/lib/prompts'
import { captureException } from '@/lib/monitoring'

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

  // 5) 런치 컨텍스트 추출 → 사용자 프로비저닝 → 세션 수립 → 앱 진입
  const ctx = extractLaunchContext(claims)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin

  // 5-a) Deep Linking 요청: 리소스 링크 프로비저닝과 분기해 콘텐츠 선택 페이지를 직접 반환한다.
  //      선택 후 /api/lti/deep-link/respond 가 서명된 LtiDeepLinkingResponse 로 회신한다.
  if (ctx.messageType === MSG_DEEP_LINKING) {
    const dl = parseDeepLinkingSettings(claims[LTI.DEEP_LINKING_SETTINGS])
    if (!dl) {
      return NextResponse.json({ error: 'deep_linking_settings 누락' }, { status: 400 })
    }
    const token = mintDeepLinkToken(
      { iss: issuer, cid: platform.client_id, dep: ctx.deploymentId, ru: dl.returnUrl, data: dl.data },
      dlTokenSecret(),
      Math.floor(Date.now() / 1000)
    )
    const html = buildSelectionPage({
      token,
      actionUrl: new URL('/api/lti/deep-link/respond', appUrl).toString(),
      chapters: SUPPORTED_CHAPTERS.map((n) => ({ value: n, label: `제${n}장` })),
      appName: 'errornote',
      heading: '수업에 추가할 챕터를 선택하세요',
      instruction: 'errornote 챕터를 LMS 모듈로 추가합니다. 학생이 클릭하면 해당 챕터 학습 화면으로 진입합니다.',
      submitLabel: 'LMS 에 추가',
    })
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const dest = ctx.isInstructor ? '/ko/dashboard' : '/ko/learn'

  // (issuer, sub) → errornote 계정 매핑/생성 후 매직링크로 로그인시킨다.
  // 프로비저닝/세션 수립 실패가 런치를 막지 않도록 방어: 실패 시 검증은 성공했으므로
  // 앱 진입점으로 폴백(미들웨어가 로그인으로 유도).
  try {
    const { userId, email } = await resolveOrProvisionIdentity(supabase, {
      issuer,
      sub: ctx.sub,
      isInstructor: ctx.isInstructor,
      name: typeof claims.name === 'string' ? claims.name : null,
      email: typeof claims.email === 'string' ? claims.email : null,
    })

    // context → class 매핑(+ 학생 수강 등록). 실패해도 세션 수립은 계속한다.
    try {
      const cls = await resolveClassForContext(
        supabase,
        {
          issuer,
          contextId: ctx.context?.id ?? null,
          contextTitle: ctx.context?.title ?? null,
          preboundClassId: (pf as { class_id?: string | null }).class_id ?? null,
        },
        userId,
        ctx.isInstructor
      )
      if (cls.classId && !ctx.isInstructor) {
        await ensureEnrollment(supabase, cls.classId, userId)
      }
    } catch (e) {
      captureException(e, { route: '/api/lti/launch', step: 'context-mapping', issuer })
    }

    const { data: link } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: new URL(dest, appUrl).toString() },
    })
    const actionLink = link?.properties?.action_link
    if (actionLink) {
      return NextResponse.redirect(actionLink, 302)
    }
  } catch (e) {
    captureException(e, { route: '/api/lti/launch', step: 'provisioning', issuer })
  }

  return NextResponse.redirect(new URL(dest, appUrl), 302)
}
