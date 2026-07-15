import { cache } from 'react'
import { createServerClient } from './supabase'

export type UserRole = 'student' | 'professor'

/** 인증 신원 최소 형태 — id/email 만 사용한다(getClaims 로 로컬 검증). */
export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthContext {
  userId: string
  role: UserRole
  email: string | null
}

/**
 * 현재 요청의 인증 신원을 1회만 확인한다.
 *
 * 성능: 예전에는 supabase.auth.getUser() 로 매 호출마다 Supabase Auth(GoTrue) 네트워크
 * 왕복이 발생했다. getClaims() 는 비대칭 서명키의 JWKS 를 캐시해 JWT 를 **로컬(WebCrypto)**
 * 로 검증하므로 네트워크 왕복이 없다(만료 시에만 getSession 이 토큰을 갱신). 대칭키 프로젝트
 * 에서는 내부적으로 getUser 로 폴백하므로 기존 대비 무회귀. React cache() 로 요청 스코프에서
 * 결과를 공유해 레이아웃·페이지·로더가 한 번만 검증을 유발하도록 한다.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const sub = typeof claims?.sub === 'string' ? claims.sub : null
  if (error || !sub) return null
  const email = typeof claims?.email === 'string' ? claims.email : null
  return { id: sub, email }
})

/**
 * 현재 요청의 Supabase 세션에서 인증된 사용자와 profiles.role 을 읽어온다.
 * 미인증 시 null 을 반환한다. 역할 체크는 호출 측에서 수행한다.
 * getCurrentUser/getAuthContext 모두 요청 스코프 캐시로 중복 왕복을 제거한다.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = createServerClient()
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[auth] profile 조회 실패:', profileErr)
    return null
  }

  const rawRole = (profile as { role?: unknown } | null)?.role
  const role: UserRole = rawRole === 'professor' ? 'professor' : 'student'

  return {
    userId: user.id,
    role,
    email: user.email ?? null
  }
})

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/** 인증 필수. 미인증이면 401 AuthError. requiredRole 지정 시 role 불일치 403. */
export async function requireAuth(requiredRole?: UserRole): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) throw new AuthError('로그인이 필요합니다', 401)
  if (requiredRole && ctx.role !== requiredRole) {
    throw new AuthError(`${requiredRole} 권한이 필요합니다`, 403)
  }
  return ctx
}
