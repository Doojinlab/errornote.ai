import { NextResponse } from 'next/server'
import { toolPublicJwks } from '@/lib/lti'

// 도구(Tool)의 공개 JWKS — 플랫폼이 도구 서명(Deep Linking/AGS 응답)을 검증할 때 사용.
// LTI_TOOL_PUBLIC_JWK 미설정 시 빈 키셋({ keys: [] }) 을 반환한다(런치 검증에는 불필요).
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(toolPublicJwks(), {
    headers: { 'cache-control': 'public, max-age=300' },
  })
}
