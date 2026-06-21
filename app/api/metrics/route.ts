import { NextResponse } from 'next/server'
import { trackMetric } from '@/lib/monitoring'
import { isAllowedMetric, sanitizeTags } from '@/lib/client-metrics'

// 클라이언트 메트릭 수집 엔드포인트 (#86, item 4). sendBeacon/keepalive-fetch 로 들어온
// PWA 설치·푸시 전환 이벤트를 화이트리스트 검증 후 trackMetric 으로 남긴다(수집기 집계).
// 인증 불요(민감정보 없음) — 대신 허용 메트릭 이름만 받아 로그 오염을 막는다.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const o = (body ?? {}) as Record<string, unknown>
  if (!isAllowedMetric(o.name)) {
    return NextResponse.json({ error: 'metric not allowed' }, { status: 400 })
  }

  const value = Number.isFinite(Number(o.value)) ? Number(o.value) : 1
  trackMetric(o.name, value, sanitizeTags(o.tags))

  return NextResponse.json({ ok: true })
}
