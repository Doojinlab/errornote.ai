// 역할(student/professor) 라우팅 캐시 쿠키 — proxy(Edge 미들웨어)와 로그인 콜백이 공유.
// server-only import(next/headers 등)를 두지 않아 Edge 런타임에서도 안전하다.
// 보안 경계가 아니라 UX 라우팅 캐시일 뿐 — 실제 인가는 RLS + requireAuth 가 담당한다.

export const ROLE_COOKIE = 'en_role'
export const ROLE_COOKIE_MAX_AGE = 60 * 60 // 1시간(역할 변경은 드묾)

export function roleCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: ROLE_COOKIE_MAX_AGE,
  }
}
