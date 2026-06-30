/**
 * 운영 배포 직후 헬스체크용 서버 env 검증 헬퍼.
 *
 * 값이 아니라 **이름**만 다룬다 — 시크릿 값은 절대 반환/로그하지 않는다.
 * 비throw(`checkServerEnv`)와 throw(`assertServerEnv`) 두 형태를 제공한다.
 * lib/supabase.ts 등 기존 모듈 로직은 건드리지 않으며, env 검증은 이 신규 파일에만 둔다.
 */

/** 앱이 뜨려면 반드시 설정돼야 하는 서버 env 이름들. (.env.example / CLAUDE.md 의 "Required" 기준) */
export const REQUIRED_SERVER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
] as const

export type RequiredServerEnv = (typeof REQUIRED_SERVER_ENV)[number]

export interface EnvCheckResult {
  ok: boolean
  /** 누락(미설정/빈 문자열)된 env **이름** 목록 — 값은 절대 포함하지 않는다. */
  missing: RequiredServerEnv[]
}

/**
 * 필수 서버 env 가 모두 설정됐는지 검사한다. **던지지 않는다.**
 * 미설정이거나 공백뿐인 값도 누락으로 본다.
 */
export function checkServerEnv(
  env: Record<string, string | undefined> = process.env
): EnvCheckResult {
  const missing = REQUIRED_SERVER_ENV.filter((name) => {
    const value = env[name]
    return value == null || value.trim() === ''
  })
  return { ok: missing.length === 0, missing }
}

/**
 * 필수 서버 env 가 하나라도 누락되면 throw 한다.
 * 메시지엔 누락 **이름**만 담는다(값 노출 금지).
 */
export function assertServerEnv(
  env: Record<string, string | undefined> = process.env
): void {
  const { ok, missing } = checkServerEnv(env)
  if (!ok) {
    throw new Error(`Missing required server env: ${missing.join(', ')}`)
  }
}
