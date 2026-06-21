// 클라이언트 → 서버 메트릭 비콘 (#86, item 4). PWA 설치/푸시 전환율 관찰용.
//
// 브라우저 이벤트(설치 배너 노출·설치 수락·푸시 활성화 등)는 클라이언트에서만 일어나는데,
// lib/monitoring.trackMetric 은 서버 console.log(JSON) 라서 브라우저에서 호출하면 수집기에
// 닿지 않는다. 이 헬퍼가 sendBeacon 으로 /api/metrics 에 보내면 서버가 trackMetric 으로 남긴다.
//
// 순수 함수(buildMetricPayload / isAllowedMetric / sanitizeTags)는 단위 테스트 대상이고,
// sendClientMetric 만 브라우저 API(navigator)에 의존한다.

export const METRICS_ENDPOINT = '/api/metrics'

// 허용 메트릭 화이트리스트 — 임의 이름으로 서버 로그를 오염시키는 것을 막는다.
export const ALLOWED_METRICS = [
  'pwa_install_prompt_shown', // 설치 배너 노출 (tags: { mode })
  'pwa_install_accepted', // beforeinstallprompt 수락
  'pwa_install_dismissed', // 배너 닫기/거절 (tags: { source })
  'pwa_push_enabled', // 웹 푸시 구독 성공
  'pwa_push_ios_needs_install', // iOS 미설치 → 설치 안내 노출
  'pwa_push_blocked', // 알림 권한 차단 상태 노출
] as const

export type AllowedMetric = (typeof ALLOWED_METRICS)[number]

export interface MetricPayload {
  name: string
  value: number
  tags?: Record<string, string | number>
}

export function isAllowedMetric(name: unknown): name is AllowedMetric {
  return typeof name === 'string' && (ALLOWED_METRICS as readonly string[]).includes(name)
}

/** 태그 정화: 스칼라(string/number)만, 키 12개·문자열 64자로 제한(로그 스팸/주입 방지). */
export function sanitizeTags(input: unknown): Record<string, string | number> | undefined {
  if (!input || typeof input !== 'object') return undefined
  const out: Record<string, string | number> = {}
  let count = 0
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= 12) break
    const key = k.slice(0, 40)
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v
      count++
    } else if (typeof v === 'string') {
      out[key] = v.slice(0, 64)
      count++
    }
  }
  return count > 0 ? out : undefined
}

export function buildMetricPayload(
  name: string,
  tags?: Record<string, string | number>,
  value = 1
): MetricPayload {
  const clean = sanitizeTags(tags)
  return { name, value, ...(clean ? { tags: clean } : {}) }
}

/** 브라우저에서 호출. 전송 실패는 조용히 무시(메트릭은 best-effort). */
export function sendClientMetric(
  name: AllowedMetric,
  tags?: Record<string, string | number>
): void {
  if (typeof navigator === 'undefined') return
  try {
    const body = JSON.stringify(buildMetricPayload(name, tags))
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(METRICS_ENDPOINT, new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(METRICS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* best-effort */
  }
}
