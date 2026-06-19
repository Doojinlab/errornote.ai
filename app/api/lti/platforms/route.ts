import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { validatePlatformInput } from '@/lib/lti-platforms'

export const runtime = 'nodejs'

// lti_platforms 는 RLS 전면 차단(service-role 전용)이므로 createAdminClient 로 접근하되,
// professor_id = 본인으로 범위를 강제해 교수자가 자신의 등록만 보고/만들도록 한다.
async function authenticate() {
  try {
    return await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) throw err
    throw new AuthError('인증 확인 실패', 500)
  }
}

const COLUMNS =
  'id, name, issuer, client_id, deployment_id, auth_login_url, auth_token_url, jwks_uri, class_id, created_at'

/** GET: 본인이 등록한 LTI 플랫폼 목록. */
export async function GET() {
  let auth
  try {
    auth = await authenticate()
  } catch (err) {
    const e = err as AuthError
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lti_platforms')
    .select(COLUMNS)
    .eq('professor_id', auth.userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/lti/platforms GET]', error)
    return NextResponse.json({ error: '플랫폼 목록 조회 실패' }, { status: 500 })
  }
  return NextResponse.json({ platforms: data ?? [] })
}

/** POST: LTI 플랫폼 등록. body: { name, issuer, clientId, deploymentId?, authLoginUrl, authTokenUrl, jwksUri, classId? } */
export async function POST(req: Request) {
  let auth
  try {
    auth = await authenticate()
  } catch (err) {
    const e = err as AuthError
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const result = validatePlatformInput(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const v = result.value

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('lti_platforms')
    .insert({
      professor_id: auth.userId,
      class_id: v.classId,
      name: v.name,
      issuer: v.issuer,
      client_id: v.clientId,
      deployment_id: v.deploymentId,
      auth_login_url: v.authLoginUrl,
      auth_token_url: v.authTokenUrl,
      jwks_uri: v.jwksUri,
    })
    .select(COLUMNS)
    .single()

  if (error) {
    // (issuer, client_id, deployment_id) unique 위반 등.
    const dup = error.code === '23505'
    return NextResponse.json(
      { error: dup ? '이미 등록된 플랫폼입니다(issuer/client_id/deployment 중복)' : '플랫폼 등록 실패' },
      { status: dup ? 409 : 500 }
    )
  }
  return NextResponse.json({ platform: data }, { status: 201 })
}
