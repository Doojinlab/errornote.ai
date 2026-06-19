// LTI 1.3 (IMS Global) 런치 기반 — Canvas/Moodle 등 LMS 표준 연동(#47).
//
// 이 모듈은 LTI 1.3 의 보안 핵심(OIDC 3-legged 로그인 + id_token 검증 + 클레임 추출)을
// 담당한다. 서명 검증(JWKS)은 jose 패키지가 설치되어 있을 때만 동작하며, 나머지 로직은
// 순수 함수로 분리해 단위 테스트로 검증한다(web-push/@sentry 와 동일한 옵션 의존성 패턴).
//
// 활성화: npm install jose  +  플랫폼 등록(lti_platforms) +  LTI_TOOL_* 환경변수.
//
// 범위(이번 PR): Resource Link 런치 검증 기반.
// 후속(#47): Deep Linking 2.0 응답 서명, AGS(점수 회신), NRPS(수강생 동기화),
//            Canvas/Moodle 인증 시나리오, 사용자 프로비저닝/세션 수립.

import crypto from 'crypto'

// ── LTI 1.3 클레임 URN ────────────────────────────────────────────────────────
export const LTI = {
  MESSAGE_TYPE: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  VERSION: 'https://purl.imsglobal.org/spec/lti/claim/version',
  DEPLOYMENT_ID: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  TARGET_LINK_URI: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  RESOURCE_LINK: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  ROLES: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  CONTEXT: 'https://purl.imsglobal.org/spec/lti/claim/context',
  CUSTOM: 'https://purl.imsglobal.org/spec/lti/claim/custom',
  AGS_ENDPOINT: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  NRPS: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
  DEEP_LINKING_SETTINGS:
    'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
} as const

export const LTI_VERSION = '1.3.0'
export const MSG_RESOURCE_LINK = 'LtiResourceLinkRequest'
export const MSG_DEEP_LINKING = 'LtiDeepLinkingRequest'

// 역할(role) URN — instructor / learner 판별
const ROLE_INSTRUCTOR =
  /#(Instructor|Administrator|TeachingAssistant|ContentDeveloper|Mentor)\b/
const ROLE_LEARNER = /#(Learner|Student)\b/

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface LtiPlatform {
  issuer: string
  client_id: string
  deployment_id: string | null
  auth_login_url: string
  auth_token_url: string
  jwks_uri: string
}

export interface LoginState {
  state: string
  nonce: string
}

export interface LtiClaims {
  [key: string]: unknown
  iss?: string
  aud?: string | string[]
  sub?: string
  exp?: number
  nonce?: string
}

export interface LaunchContext {
  messageType: string
  version: string
  deploymentId: string
  targetLinkUri: string
  sub: string
  resourceLinkId: string | null
  roles: string[]
  isInstructor: boolean
  isLearner: boolean
  context: { id?: string; label?: string; title?: string } | null
  ags: unknown | null
  nrps: unknown | null
}

// ── OIDC 로그인 개시 ──────────────────────────────────────────────────────────

/** OIDC 라운드트립 검증용 state/nonce 생성(추측 불가 난수). */
export function createLoginState(): LoginState {
  return {
    state: crypto.randomBytes(24).toString('base64url'),
    nonce: crypto.randomBytes(24).toString('base64url'),
  }
}

/**
 * 3-legged OIDC 로그인 개시 요청 URL 구성(LTI 1.3 §5.1.1).
 * 플랫폼 auth_login_url 로 리다이렉트할 절대 URL 을 만든다. 순수 함수.
 */
export function buildAuthRequestUrl(
  platform: LtiPlatform,
  args: {
    loginHint: string
    messageHint?: string
    redirectUri: string
    state: string
    nonce: string
  }
): string {
  const u = new URL(platform.auth_login_url)
  const p = u.searchParams
  p.set('scope', 'openid')
  p.set('response_type', 'id_token')
  p.set('response_mode', 'form_post')
  p.set('prompt', 'none')
  p.set('client_id', platform.client_id)
  p.set('redirect_uri', args.redirectUri)
  p.set('login_hint', args.loginHint)
  p.set('state', args.state)
  p.set('nonce', args.nonce)
  if (args.messageHint) p.set('lti_message_hint', args.messageHint)
  if (platform.deployment_id) p.set('lti_deployment_id', platform.deployment_id)
  return u.toString()
}

// ── id_token 검증/추출 ────────────────────────────────────────────────────────

/** 서명 검증된 id_token 페이로드에서 LTI 런치 컨텍스트를 추출. 순수 함수. */
export function extractLaunchContext(claims: LtiClaims): LaunchContext {
  const roles = Array.isArray(claims[LTI.ROLES])
    ? (claims[LTI.ROLES] as string[])
    : []
  const ctx =
    (claims[LTI.CONTEXT] as
      | { id?: string; label?: string; title?: string }
      | undefined) ?? null
  const rl = claims[LTI.RESOURCE_LINK] as { id?: string } | undefined
  return {
    messageType: String(claims[LTI.MESSAGE_TYPE] ?? ''),
    version: String(claims[LTI.VERSION] ?? ''),
    deploymentId: String(claims[LTI.DEPLOYMENT_ID] ?? ''),
    targetLinkUri: String(claims[LTI.TARGET_LINK_URI] ?? ''),
    sub: String(claims.sub ?? ''),
    resourceLinkId: rl?.id ?? null,
    roles,
    isInstructor: roles.some((r) => ROLE_INSTRUCTOR.test(r)),
    isLearner: roles.some((r) => ROLE_LEARNER.test(r)),
    context: ctx,
    ags: claims[LTI.AGS_ENDPOINT] ?? null,
    nrps: claims[LTI.NRPS] ?? null,
  }
}

/**
 * LTI 1.3 필수 클레임 검사(서명/만료/aud 는 verifyIdToken 이 처리).
 * 위반 시 사유 문자열, 정상 시 null 반환. 순수 함수 — 테스트 용이.
 */
export function validateLaunchClaims(
  claims: LtiClaims,
  expected: { issuer: string; nonce: string; deploymentId?: string | null }
): string | null {
  if (claims.iss !== expected.issuer) return `iss 불일치: ${String(claims.iss)}`
  if (!claims.nonce || claims.nonce !== expected.nonce) {
    return 'nonce 불일치(재생 공격 가능)'
  }
  const mt = claims[LTI.MESSAGE_TYPE]
  if (mt !== MSG_RESOURCE_LINK && mt !== MSG_DEEP_LINKING) {
    return `지원하지 않는 message_type: ${String(mt)}`
  }
  if (claims[LTI.VERSION] !== LTI_VERSION) {
    return `LTI version 불일치: ${String(claims[LTI.VERSION])}`
  }
  const dep = claims[LTI.DEPLOYMENT_ID]
  if (!dep) return 'deployment_id 누락'
  if (expected.deploymentId && dep !== expected.deploymentId) {
    return 'deployment_id 불일치'
  }
  return null
}

/** 도구(Tool)의 공개 JWKS. LTI_TOOL_PUBLIC_JWK(JSON) 설정 시 노출, 아니면 빈 키셋. */
export function toolPublicJwks(): { keys: Record<string, unknown>[] } {
  const raw = process.env.LTI_TOOL_PUBLIC_JWK
  if (!raw) return { keys: [] }
  try {
    const jwk = JSON.parse(raw) as Record<string, unknown>
    return { keys: [jwk] }
  } catch {
    return { keys: [] }
  }
}

// ── 서명 검증(옵션 의존성: jose) ──────────────────────────────────────────────
interface JoseLike {
  createRemoteJWKSet: (url: URL) => unknown
  jwtVerify: (
    token: string,
    keyset: unknown,
    opts?: Record<string, unknown>
  ) => Promise<{ payload: LtiClaims }>
}

let _jose: JoseLike | null | undefined
function getJose(): JoseLike | null {
  if (_jose !== undefined) return _jose
  try {
    // eslint-disable-next-line no-eval
    const req = (0, eval)('require') as NodeRequire
    _jose = req('jose') as JoseLike
  } catch {
    _jose = null
  }
  return _jose
}

/** jose 설치 여부 — LTI 서명 검증 가능 여부. */
export function isLtiVerificationAvailable(): boolean {
  return getJose() !== null
}

/**
 * id_token(JWT) 서명을 플랫폼 JWKS 로 검증하고 페이로드를 반환(LTI 1.3 §5.1.3).
 * iss/aud/exp 는 jose 가 검증한다. nonce/클레임은 validateLaunchClaims 로 별도 검사.
 * jose 미설치 시 명확한 에러(npm install jose).
 */
export async function verifyIdToken(
  idToken: string,
  platform: LtiPlatform
): Promise<LtiClaims> {
  const jose = getJose()
  if (!jose) {
    throw new Error('LTI id_token 검증에는 jose 패키지가 필요합니다 (npm install jose)')
  }
  const jwks = jose.createRemoteJWKSet(new URL(platform.jwks_uri))
  const { payload } = await jose.jwtVerify(idToken, jwks, {
    issuer: platform.issuer,
    audience: platform.client_id,
  })
  return payload
}
