import { createAdminClient, createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/**
 * next 파라미터를 same-origin 상대 경로일 때만 허용한다.
 * '/' 로 시작하되 '//' 또는 '/\' 로 시작하는(프로토콜 상대/우회) 값은 외부로
 * 빠질 수 있으므로 거부하고 '/learn' 으로 폴백한다.
 */
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    return next
  }
  return '/learn'
}

/**
 * profiles row 를 보장한다(방어적).
 * 정상 가입은 auth.users insert 트리거 handle_new_user() 가 role='student' row 를
 * 만든다. 하지만 트리거 도입 이전에 생성됐거나 어떤 이유로 트리거가 돌지 않은
 * 계정은 profiles row 가 없다. 이 경우 proxy 의 역할 가드가 role 을 해석하지 못해
 * /learn ↔ /dashboard 무한 리디렉트(ERR_TOO_MANY_REDIRECTS)에 빠진다.
 * 로그인 성공 시점에 프로필 존재를 보장해 이 상태를 원천 차단한다.
 * profiles 에는 INSERT RLS 정책이 없으므로(트리거 전담) admin 클라이언트로 upsert 한다.
 * ignoreDuplicates: 기존 프로필(역할 등)은 절대 덮어쓰지 않는다.
 */
async function ensureProfile(userId: string, meta: Record<string, unknown>) {
  try {
    const admin = createAdminClient()
    const role = meta.role === 'professor' ? 'professor' : 'student'
    const name =
      (typeof meta.name === 'string' && meta.name) ||
      (typeof meta.full_name === 'string' && meta.full_name) ||
      ''
    await admin
      .from('profiles')
      .upsert({ id: userId, role, name }, { onConflict: 'id', ignoreDuplicates: true })
  } catch {
    // 프로필 보장 실패가 로그인 자체를 막아서는 안 된다. 트리거가 정상 동작하는
    // 대다수 경우엔 이 fallback 이 필요 없으므로 조용히 넘어간다.
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (data.user) {
        await ensureProfile(data.user.id, data.user.user_metadata ?? {})
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
