import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { buildAuthRequestUrl, createLoginState, type LtiPlatform } from '@/lib/lti'

// LTI 1.3 OIDC 로그인 개시(§5.1.1). 플랫폼이 iss/login_hint/target_link_uri 와 함께
// GET 또는 POST 로 호출한다. 등록된 플랫폼을 찾아 state/nonce 를 저장하고, 플랫폼
// auth_login_url 로 인증 요청을 리다이렉트한다.
export const runtime = 'nodejs'

function toolLaunchUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return new URL('/api/lti/launch', appUrl).toString()
}

async function handle(params: URLSearchParams): Promise<NextResponse> {
  const iss = params.get('iss')
  const loginHint = params.get('login_hint')
  const targetLinkUri = params.get('target_link_uri')
  const messageHint = params.get('lti_message_hint') ?? undefined
  const clientId = params.get('client_id') ?? undefined

  if (!iss || !loginHint || !targetLinkUri) {
    return NextResponse.json(
      { error: 'missing required parameter: iss / login_hint / target_link_uri' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  let query = supabase.from('lti_platforms').select('*').eq('issuer', iss)
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query.limit(1).maybeSingle()
  if (error || !data) {
    return NextResponse.json({ error: 'unknown LTI platform' }, { status: 404 })
  }
  const platform = data as unknown as LtiPlatform

  const { state, nonce } = createLoginState()
  const { error: insErr } = await supabase
    .from('lti_login_states')
    .insert({ state, nonce, issuer: iss } as never)
  if (insErr) {
    return NextResponse.json({ error: 'failed to persist login state' }, { status: 500 })
  }

  const url = buildAuthRequestUrl(platform, {
    loginHint,
    messageHint,
    redirectUri: toolLaunchUri(),
    state,
    nonce,
  })
  return NextResponse.redirect(url, 302)
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams)
}

export async function POST(req: Request) {
  const form = await req.formData()
  const params = new URLSearchParams()
  for (const [k, v] of form.entries()) params.set(k, String(v))
  return handle(params)
}
