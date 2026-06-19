// #50 — Next.js instrumentation hook. 서버 시작 시 1회 실행.
// @sentry/nextjs 가 설치되어 있고 SENTRY_DSN 이 있으면 Node 런타임에서 Sentry 를
// 초기화한다. 미설치/미설정이면 no-op (빌드 하드 의존성 없음).
//
// 주의: instrumentation 은 Edge 런타임용으로도 번들된다. Edge 는 eval/new Function 을
// 금지하므로 eval-require 대신 (1) NEXT_RUNTIME 가드 + (2) 계산된 모듈 지정자 동적 import
// 를 쓴다(번들러가 정적으로 해석하지 못해 미설치여도 빌드가 깨지지 않는다).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (!process.env.SENTRY_DSN) return
  try {
    const mod = ['@sentry', 'nextjs'].join('/') // 정적 해석 회피
    const Sentry = (await import(/* @vite-ignore */ mod)) as {
      init: (opts: Record<string, unknown>) => void
    }
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    })
  } catch {
    // @sentry/nextjs 미설치 — 무시.
  }
}

// Next.js 가 서버(Server Component/Route Handler/middleware) 요청 처리 중 발생한
// 에러마다 호출하는 훅. Sentry 가 있으면 요청 컨텍스트와 함께 보고한다.
// register() 와 동일한 옵션 의존성 패턴 — 미설치/미설정이면 no-op.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: { [key: string]: string } },
  context: { routerKind: string; routePath: string; routeType: string }
): Promise<void> {
  if (!process.env.SENTRY_DSN) return
  try {
    const mod = ['@sentry', 'nextjs'].join('/') // 정적 해석 회피
    const Sentry = (await import(/* @vite-ignore */ mod)) as {
      captureRequestError?: (e: unknown, req: unknown, ctx: unknown) => void
      captureException?: (e: unknown) => void
    }
    if (Sentry.captureRequestError) Sentry.captureRequestError(err, request, context)
    else Sentry.captureException?.(err)
  } catch {
    // @sentry/nextjs 미설치 — 무시.
  }
}
