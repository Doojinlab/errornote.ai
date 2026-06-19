// LTI Deep Linking 핸드오프 토큰 (#47).
//
// DL 런치(launch route)에서 콘텐츠 선택 페이지로, 다시 응답 서명 라우트로 넘어가는 동안
// 서버는 무상태로 동작해야 한다(추가 테이블 없이). 그래서 응답 서명에 필요한 컨텍스트
// (issuer/client_id/deployment_id/return_url/data)를 HMAC-SHA256 으로 서명한 짧은 수명의
// 토큰에 담아 폼 hidden 필드로 운반한다. 변조 불가 + 만료로 재사용을 막는다.
//
// 순수 함수(crypto 만 사용) — 단위 테스트로 검증한다.

import crypto from 'crypto'

/**
 * HMAC 토큰 서명 비밀키 해석. 전용 LTI_DL_SECRET 우선, 없으면 서버 전용
 * SUPABASE_SERVICE_ROLE_KEY 로 폴백(둘 다 서버에만 존재). 토큰 서명/검증이 같은
 * 키만 쓰면 되므로 외부 노출 없이 무상태 운반이 안전하다.
 */
export function dlTokenSecret(): string {
  return process.env.LTI_DL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export interface DeepLinkTokenPayload {
  /** 플랫폼 issuer */
  iss: string
  /** 도구 client_id */
  cid: string
  /** deployment_id */
  dep: string
  /** deep_link_return_url */
  ru: string
  /** 런치 opaque data (echo 대상), 없으면 null */
  data: string | null
  /** 만료(epoch 초) */
  exp: number
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function sign(payloadB64: string, secret: string): string {
  return b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest())
}

/** 페이로드를 HMAC 서명 토큰으로 직렬화. `<payload>.<sig>` (둘 다 base64url). */
export function mintDeepLinkToken(
  payload: Omit<DeepLinkTokenPayload, 'exp'>,
  secret: string,
  nowSec: number,
  ttlSec = 900
): string {
  const full: DeepLinkTokenPayload = { ...payload, exp: nowSec + ttlSec }
  const payloadB64 = b64url(Buffer.from(JSON.stringify(full), 'utf8'))
  return `${payloadB64}.${sign(payloadB64, secret)}`
}

/**
 * 토큰 검증 + 파싱. 서명 불일치/형식 오류/만료 시 null.
 * 서명 비교는 timing-safe.
 */
export function verifyDeepLinkToken(
  token: string,
  secret: string,
  nowSec: number
): DeepLinkTokenPayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payloadB64, sig] = token.split('.', 2)
  if (!payloadB64 || !sig) return null

  const expected = sign(payloadB64, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload: DeepLinkTokenPayload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as DeepLinkTokenPayload
  } catch {
    return null
  }
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) return null
  if (!payload.iss || !payload.cid || !payload.ru) return null
  return payload
}
