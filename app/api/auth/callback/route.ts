import { createServerClient } from '@/lib/supabase'
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
