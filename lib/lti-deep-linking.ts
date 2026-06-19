// LTI 1.3 Deep Linking 2.0 — 콘텐츠 선택 응답 (#47).
//
// 플랫폼이 LtiDeepLinkingRequest 로 런치하면, 교수자가 errornote 챕터(리소스)를 고르고
// 도구가 서명한 LtiDeepLinkingResponse(JWT)를 deep_link_return_url 로 form_post 회신한다.
//
// 패턴은 lib/lti-ags.ts 와 동일: 순수 빌더(설정 파싱/콘텐츠 아이템/응답 클레임/자동제출 폼)는
// 단위 테스트하고, JWT 서명(jose + 도구 개인키)은 런타임 검증 항목으로 둔다
// (docs/verification-runbook.md). 활성화: npm install jose + LTI_TOOL_PRIVATE_KEY/KID.

import { LTI, LTI_VERSION } from './lti'

export const MSG_DEEP_LINKING_RESPONSE = 'LtiDeepLinkingResponse'

/** Deep Linking 전용 클레임 URN. */
export const DL = {
  CONTENT_ITEMS: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  DATA: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
} as const

// ── deep_linking_settings 파싱 ────────────────────────────────────────────────
export interface DeepLinkingSettings {
  returnUrl: string
  data: string | null
  acceptTypes: string[]
  acceptMultiple: boolean
  acceptPresentationDocumentTargets: string[]
}

/**
 * 런치 claims 의 deep_linking_settings 클레임을 파싱(순수).
 * deep_link_return_url 이 없으면 회신할 곳이 없으므로 null.
 */
export function parseDeepLinkingSettings(claim: unknown): DeepLinkingSettings | null {
  if (!claim || typeof claim !== 'object') return null
  const c = claim as Record<string, unknown>
  const returnUrl = typeof c.deep_link_return_url === 'string' ? c.deep_link_return_url : ''
  if (!returnUrl) return null
  return {
    returnUrl,
    data: typeof c.data === 'string' ? c.data : null,
    acceptTypes: Array.isArray(c.accept_types)
      ? c.accept_types.filter((s): s is string => typeof s === 'string')
      : [],
    acceptMultiple: c.accept_multiple === true || c.accept_multiple === 'true',
    acceptPresentationDocumentTargets: Array.isArray(c.accept_presentation_document_targets)
      ? c.accept_presentation_document_targets.filter((s): s is string => typeof s === 'string')
      : [],
  }
}

// ── 콘텐츠 아이템 ──────────────────────────────────────────────────────────────
export interface ResourceLinkContentItem {
  type: 'ltiResourceLink'
  title: string
  url: string
  custom: Record<string, string>
}

/**
 * ltiResourceLink 콘텐츠 아이템 생성(순수). 이후 리소스 링크 런치가 custom 파라미터를
 * 그대로 싣고 오므로, errornote 챕터/수업 컨텍스트를 custom 에 담는다.
 */
export function buildResourceLinkContentItem(params: {
  url: string
  title: string
  custom?: Record<string, string | number>
}): ResourceLinkContentItem {
  const custom: Record<string, string> = {}
  for (const [k, v] of Object.entries(params.custom ?? {})) {
    custom[k] = String(v)
  }
  return { type: 'ltiResourceLink', title: params.title, url: params.url, custom }
}

// ── 응답 클레임 ────────────────────────────────────────────────────────────────
export interface DeepLinkingResponseClaimsInput {
  /** 도구 client_id — 응답 JWT 의 iss(및 azp). */
  clientId: string
  /** 플랫폼 issuer — 응답 JWT 의 aud. */
  issuer: string
  deploymentId: string
  contentItems: ResourceLinkContentItem[]
  /** 런치 시 받은 opaque data 를 그대로 echo(있을 때). */
  data?: string | null
  /** 재생 방지용 난수. */
  nonce: string
  /** 발행 시각(초, epoch). 테스트 주입용. */
  nowSec: number
  /** 만료까지 초. 기본 300. */
  ttlSec?: number
}

/**
 * LtiDeepLinkingResponse JWT 의 클레임 맵 생성(순수, 서명 전).
 * iss=도구 client_id, aud=플랫폼 issuer (id_token 과 방향이 반대).
 */
export function buildDeepLinkingResponseClaims(
  input: DeepLinkingResponseClaimsInput
): Record<string, unknown> {
  const ttl = input.ttlSec ?? 300
  const claims: Record<string, unknown> = {
    iss: input.clientId,
    aud: input.issuer,
    azp: input.clientId,
    iat: input.nowSec,
    exp: input.nowSec + ttl,
    nonce: input.nonce,
    [LTI.MESSAGE_TYPE]: MSG_DEEP_LINKING_RESPONSE,
    [LTI.VERSION]: LTI_VERSION,
    [LTI.DEPLOYMENT_ID]: input.deploymentId,
    [DL.CONTENT_ITEMS]: input.contentItems,
  }
  if (input.data) claims[DL.DATA] = input.data
  return claims
}

// ── 자동 제출 폼(form_post) ────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 응답 JWT 를 deep_link_return_url 로 자동 POST 하는 자족 HTML(순수).
 * JWT/returnUrl 은 HTML 이스케이프한다.
 */
export function buildAutoPostForm(returnUrl: string, jwt: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>errornote</title></head>
<body onload="document.forms[0].submit()">
<form action="${escapeHtml(returnUrl)}" method="POST">
<input type="hidden" name="JWT" value="${escapeHtml(jwt)}">
<noscript><button type="submit">Continue</button></noscript>
</form>
</body></html>`
}

/**
 * 교수자 콘텐츠 선택 페이지 HTML(순수, 자족). DL 런치 직후 launch route 가 직접 반환한다.
 * 토큰은 hidden 필드로 운반되고, 챕터 선택 후 actionUrl 로 POST 된다.
 * 라벨은 주입형 — 호출측이 런치 로케일에 맞춰 번역해 넘긴다.
 */
export function buildSelectionPage(params: {
  token: string
  actionUrl: string
  chapters: Array<{ value: number; label: string }>
  appName: string
  heading: string
  instruction: string
  submitLabel: string
}): string {
  const options = params.chapters
    .map(
      (c, i) =>
        `<label class="row"><input type="radio" name="chapter" value="${c.value}"${
          i === 0 ? ' checked' : ''
        }> ${escapeHtml(c.label)}</label>`
    )
    .join('\n')
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(params.appName)}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a}
  .card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:18px;margin:0 0 4px}
  p.sub{color:#64748b;font-size:14px;margin:0 0 16px}
  .row{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;font-size:15px;cursor:pointer}
  .row:hover{background:#f8fafc}
  button{margin-top:8px;width:100%;background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:12px;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#4338ca}
</style></head>
<body><div class="card">
<h1>${escapeHtml(params.appName)}</h1>
<p class="sub">${escapeHtml(params.instruction)}</p>
<form action="${escapeHtml(params.actionUrl)}" method="POST">
<input type="hidden" name="token" value="${escapeHtml(params.token)}">
<fieldset style="border:0;padding:0;margin:0">
<legend style="font-weight:600;font-size:14px;margin-bottom:8px">${escapeHtml(params.heading)}</legend>
${options}
</fieldset>
<button type="submit">${escapeHtml(params.submitLabel)}</button>
</form>
</div></body></html>`
}

// ── JWT 서명(옵션 의존성: jose) ────────────────────────────────────────────────
interface JoseSignLike {
  importPKCS8: (pem: string, alg: string) => Promise<unknown>
  SignJWT: new (payload: Record<string, unknown>) => {
    setProtectedHeader: (h: Record<string, unknown>) => { sign: (key: unknown) => Promise<string> }
  }
}

let _joseSign: JoseSignLike | null | undefined
function getJoseSign(): JoseSignLike | null {
  if (_joseSign !== undefined) return _joseSign
  try {
    // eslint-disable-next-line no-eval
    const req = (0, eval)('require') as NodeRequire
    _joseSign = req('jose') as JoseSignLike
  } catch {
    _joseSign = null
  }
  return _joseSign
}

/** 도구 개인키(PKCS8 PEM)로 서명 가능한지 — jose 설치 + 키 설정 여부. */
export function isDeepLinkingSigningAvailable(): boolean {
  return getJoseSign() !== null && !!process.env.LTI_TOOL_PRIVATE_KEY
}

/**
 * Deep Linking 응답 클레임을 RS256 JWT 로 서명. 도구 개인키(PKCS8 PEM)는
 * LTI_TOOL_PRIVATE_KEY, kid 는 LTI_TOOL_KID 에서 읽는다. jose/키 미설정 시 명확한 에러.
 */
export async function signDeepLinkingResponse(
  claims: Record<string, unknown>
): Promise<string> {
  const jose = getJoseSign()
  if (!jose) {
    throw new Error('Deep Linking 응답 서명에는 jose 패키지가 필요합니다 (npm install jose)')
  }
  const pem = process.env.LTI_TOOL_PRIVATE_KEY
  if (!pem) {
    throw new Error('LTI_TOOL_PRIVATE_KEY(도구 개인키 PKCS8 PEM)가 설정되지 않았습니다')
  }
  const kid = process.env.LTI_TOOL_KID
  const key = await jose.importPKCS8(pem.replace(/\\n/g, '\n'), 'RS256')
  const header: Record<string, unknown> = { alg: 'RS256', typ: 'JWT' }
  if (kid) header.kid = kid
  return new jose.SignJWT(claims).setProtectedHeader(header).sign(key)
}
