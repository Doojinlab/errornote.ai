import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createServerClient } from './supabase'

export type UserRole = 'student' | 'professor'

export interface AuthContext {
  userId: string
  role: UserRole
  email: string | null
}

/**
 * 현재 요청의 인증 사용자(getUser)를 1회만 조회한다. supabase.auth.getUser() 는
 * 매번 Supabase Auth 네트워크 왕복이므로, 한 요청 안에서 레이아웃·페이지·로더가
 * 제각기 호출하면 왕복이 수 배로 늘어난다. React cache() 로 요청 스코프에서 결과를
 * 공유해 렌더 트리 전체가 단 한 번의 getUser 만 유발하도록 한다.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
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
