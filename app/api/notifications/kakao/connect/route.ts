// GET /api/notifications/kakao/connect          — Kakao OAuth 인증 시작 (카카오로 리다이렉트)
// GET /api/notifications/kakao/connect?code=... — Kakao OAuth 콜백 처리
// DELETE /api/notifications/kakao/connect       — 카카오 연동 해제 (토큰 폐기)

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import {
  buildKakaoAuthUrl,
  exchangeCodeForToken,
  getKakaoUserInfo,
} from '@/lib/kakao'
import { setKakaoTokens, clearKakaoTokens } from '@/lib/kakao-tokens'
import { logSecurityEvent } from '@/lib/security-log'

export const runtime = 'nodejs'

const STATE_COOKIE = 'kakao_oauth_state'

/**
 * redirect_uri 를 신뢰 가능한 환경변수로부터 구성한다.
 * Host 헤더는 위조 가능하므로 사용하지 않는다.
 */
function getRedirectUri(): string {
  const explicit = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI
  if (explicit) return explicit
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/api/notifications/kakao/connect`
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    logSecurityEvent({ tag: 'kakao_token', event: 'oauth_error', oauth_error: oauthError })
    return NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
  }

  const redirectUri = getRedirectUri()

  if (!code) {
    // OAuth 시작 — 계정 바인딩 CSRF 방지용 암호학적 랜덤 state 생성 후 쿠키에 저장.
    const state = randomBytes(32).toString('hex')
    const authUrl = new URL(buildKakaoAuthUrl(redirectUri))
    authUrl.searchParams.set('state', state)
    const res = NextResponse.redirect(authUrl.toString())
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    })
    return res
  }

  // OAuth 콜백 — code 있음. 먼저 state 일치 검증 (CSRF 방지).
  const expectedState = req.cookies.get(STATE_COOKIE)?.value ?? null
  const receivedState = searchParams.get('state')
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    logSecurityEvent({ tag: 'kakao_token', event: 'state_mismatch' })
    const res = NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
    res.cookies.delete(STATE_COOKIE)
    return res
  }

  const user = await getCurrentUser()

  if (!user) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(STATE_COOKIE)
    return res
  }

  try {
    const tokens = await exchangeCodeForToken(code, redirectUri)
    const kakaoUser = await getKakaoUserInfo(tokens.access_token)

    const admin = createAdminClient()
    await setKakaoTokens(admin, user.id, {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      kakaoUserId: String(kakaoUser.id),
    })

    logSecurityEvent({
      tag: 'kakao_token',
      event: 'connect',
      user_id: user.id,
      kakao_user_id: String(kakaoUser.id),
    })

    const res = NextResponse.redirect(new URL('/notifications?kakao=connected', req.url))
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Kakao OAuth 처리 실패:', message)
    logSecurityEvent({
      tag: 'kakao_token',
      event: 'connect_failed',
      user_id: user.id,
      error: message.slice(0, 200),
    })
    const res = NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
    res.cookies.delete(STATE_COOKIE)
    return res
  }
}

export async function DELETE(_req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    await clearKakaoTokens(admin, user.id)
    logSecurityEvent({ tag: 'kakao_token', event: 'disconnect', user_id: user.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Kakao 연동 해제 실패:', message)
    return NextResponse.json({ error: '해제 실패' }, { status: 500 })
  }
}
