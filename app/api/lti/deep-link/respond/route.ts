import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { SUPPORTED_CHAPTERS } from '@/lib/prompts'
import { verifyDeepLinkToken, dlTokenSecret } from '@/lib/lti-dl-token'
import {
  buildResourceLinkContentItem,
  buildDeepLinkingResponseClaims,
  buildAutoPostForm,
  signDeepLinkingResponse,
} from '@/lib/lti-deep-linking'

// LTI Deep Linking 응답(§3.3). 콘텐츠 선택 폼이 POST 한 token + chapter 로
//   1) 핸드오프 토큰 검증(HMAC + 만료)
//   2) ltiResourceLink 콘텐츠 아이템 구성(custom.chapter 운반)
//   3) LtiDeepLinkingResponse JWT 서명(도구 개인키)
//   4) deep_link_return_url 로 자동 POST 하는 HTML 반환
export const runtime = 'nodejs'

function htmlError(message: string, status: number): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:24px;color:#0f172a"><p>${message}</p></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function POST(req: Request) {
  const form = await req.formData()
  const token = String(form.get('token') ?? '')
  const chapter = Number(form.get('chapter'))

  if (!Number.isInteger(chapter) || !SUPPORTED_CHAPTERS.includes(chapter)) {
    return htmlError('유효하지 않은 챕터입니다.', 400)
  }

  const payload = verifyDeepLinkToken(token, dlTokenSecret(), Math.floor(Date.now() / 1000))
  if (!payload) {
    return htmlError('Deep Linking 세션이 만료되었거나 유효하지 않습니다. 다시 시도해주세요.', 400)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const contentItem = buildResourceLinkContentItem({
    url: new URL('/api/lti/launch', appUrl).toString(),
    title: `errornote 제${chapter}장`,
    custom: { chapter },
  })

  const claims = buildDeepLinkingResponseClaims({
    clientId: payload.cid,
    issuer: payload.iss,
    deploymentId: payload.dep,
    contentItems: [contentItem],
    data: payload.data,
    nonce: crypto.randomBytes(16).toString('base64url'),
    nowSec: Math.floor(Date.now() / 1000),
  })

  let jwt: string
  try {
    jwt = await signDeepLinkingResponse(claims)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // jose/도구 개인키 미설정 시 활성화 안내(런타임 활성화 항목).
    return htmlError(`Deep Linking 응답 서명 실패: ${msg}`, 500)
  }

  return new NextResponse(buildAutoPostForm(payload.ru, jwt), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
