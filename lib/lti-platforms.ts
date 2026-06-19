// LTI 1.3 플랫폼 등록 입력 검증 (#47).
// lti_platforms 는 service-role 전용(RLS 전면 차단)이라 등록은 API 라우트(createAdminClient)에서만
// 수행한다. 여기서는 입력 검증만 순수 함수로 분리해 단위 테스트한다(라우트는 이 결과를 신뢰).

export interface PlatformInput {
  name: string
  issuer: string
  clientId: string
  deploymentId: string | null
  authLoginUrl: string
  authTokenUrl: string
  jwksUri: string
  classId: string | null
}

export type ValidateResult =
  | { ok: true; value: PlatformInput }
  | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** http(s) 절대 URL 인지 검사(순수). */
export function isHttpUrl(value: string): boolean {
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return false
  }
  return u.protocol === 'http:' || u.protocol === 'https:'
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 플랫폼 등록 입력 검증(순수). 필수 필드 + 엔드포인트 URL 유효성 + issuer(URL) 검사.
 * deployment_id/class_id 는 선택. 위반 시 사유 문자열을 담아 ok:false.
 */
export function validatePlatformInput(raw: unknown): ValidateResult {
  const o = (raw ?? {}) as Record<string, unknown>

  const name = str(o.name)
  if (!name) return { ok: false, error: 'name 은 필수입니다' }

  const issuer = str(o.issuer)
  if (!issuer) return { ok: false, error: 'issuer 는 필수입니다' }
  if (!isHttpUrl(issuer)) return { ok: false, error: 'issuer 는 유효한 URL 이어야 합니다' }

  const clientId = str(o.clientId ?? o.client_id)
  if (!clientId) return { ok: false, error: 'client_id 는 필수입니다' }

  const authLoginUrl = str(o.authLoginUrl ?? o.auth_login_url)
  if (!isHttpUrl(authLoginUrl)) {
    return { ok: false, error: 'auth_login_url 은 유효한 URL 이어야 합니다' }
  }
  const authTokenUrl = str(o.authTokenUrl ?? o.auth_token_url)
  if (!isHttpUrl(authTokenUrl)) {
    return { ok: false, error: 'auth_token_url 은 유효한 URL 이어야 합니다' }
  }
  const jwksUri = str(o.jwksUri ?? o.jwks_uri)
  if (!isHttpUrl(jwksUri)) {
    return { ok: false, error: 'jwks_uri 는 유효한 URL 이어야 합니다' }
  }

  const deploymentId = str(o.deploymentId ?? o.deployment_id) || null

  const classIdRaw = str(o.classId ?? o.class_id)
  if (classIdRaw && !UUID_RE.test(classIdRaw)) {
    return { ok: false, error: 'class_id 는 UUID 형식이어야 합니다' }
  }
  const classId = classIdRaw || null

  return {
    ok: true,
    value: { name, issuer, clientId, deploymentId, authLoginUrl, authTokenUrl, jwksUri, classId },
  }
}
