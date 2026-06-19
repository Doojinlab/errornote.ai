// #50 — 통합 운영 모니터링 seam.
//
// 에러/메시지/메트릭을 한 곳으로 모은다. @sentry/nextjs 가 설치되어 있고 SENTRY_DSN 이
// 설정되어 있으면 Sentry 로 전송하고, 아니면 구조적(JSON) 콘솔 로그로 폴백한다.
// (Vercel/CloudWatch 등 로그 수집기가 JSON 라인을 파싱한다.)
//
// Sentry 활성화:
//   1) npm install @sentry/nextjs
//   2) SENTRY_DSN(서버) / NEXT_PUBLIC_SENTRY_DSN(클라이언트) 환경변수 설정
//   3) instrumentation.ts 의 register() 가 서버 초기화를 수행
// 미설치/미설정이어도 본 모듈은 안전하게 동작한다(빌드에 하드 의존성 없음).

export type Severity = 'info' | 'warning' | 'error'

export interface MonitoringContext {
  [key: string]: unknown
}

// web-push 와 동일한 런타임 require 패턴 — 미설치 시 tsc/번들에 영향 없음.
interface SentryLike {
  captureException: (e: unknown, hint?: { extra?: MonitoringContext }) => void
  captureMessage: (msg: string, level?: string) => void
}

let _sentry: SentryLike | null | undefined
function getSentry(): SentryLike | null {
  if (_sentry !== undefined) return _sentry
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    _sentry = null
    return null
  }
  try {
    // eslint-disable-next-line no-eval
    const req = (0, eval)('require') as NodeRequire
    _sentry = req('@sentry/nextjs') as SentryLike
  } catch {
    _sentry = null
  }
  return _sentry
}

function structuredLog(
  tag: string,
  level: Severity,
  message: string,
  context?: MonitoringContext
): void {
  const line = JSON.stringify({
    tag,
    level,
    message,
    ...(context ? { context } : {}),
    ts: new Date().toISOString(),
  })
  if (level === 'error') console.error(line)
  else if (level === 'warning') console.warn(line)
  else console.log(line)
}

/** 예외 보고. Sentry 가 있으면 전송, 없으면 구조적 에러 로그. */
export function captureException(err: unknown, context?: MonitoringContext): void {
  const sentry = getSentry()
  if (sentry) {
    sentry.captureException(err, context ? { extra: context } : undefined)
    return
  }
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  structuredLog('exception', 'error', message, {
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    ...context,
  })
}

/** 운영 메시지/알림(쿼터 초과 등). */
export function captureMessage(
  message: string,
  level: Severity = 'info',
  context?: MonitoringContext
): void {
  const sentry = getSentry()
  if (sentry) {
    sentry.captureMessage(message, level)
    return
  }
  structuredLog('message', level, message, context)
}

/** 수치 메트릭(비용/지연/카운트 등) — 항상 구조적 로그로 남겨 수집기가 집계. */
export function trackMetric(
  name: string,
  value: number,
  tags?: Record<string, string | number>
): void {
  console.log(
    JSON.stringify({
      tag: 'metric',
      metric: name,
      value,
      ...(tags ? { tags } : {}),
      ts: new Date().toISOString(),
    })
  )
}
