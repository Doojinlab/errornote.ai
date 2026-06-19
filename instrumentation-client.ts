// #50 — Next.js 클라이언트 instrumentation. 브라우저 진입 시 1회 실행된다.
// NEXT_PUBLIC_SENTRY_DSN 이 있고 @sentry/nextjs 가 설치되어 있으면 브라우저 Sentry 를
// 초기화한다. 미설치/미설정이면 no-op (빌드 하드 의존성 없음).
//
// 서버측 instrumentation.ts 와 동일한 "옵션 의존성" 패턴:
// DSN 가드로 먼저 빠져나가고, 계산된 모듈 지정자 동적 import 로 번들러 정적 해석을 회피한다
// (미설치여도 클라이언트 번들이 깨지지 않는다).

async function initClientSentry(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  try {
    const mod = ['@sentry', 'nextjs'].join('/') // 정적 해석 회피
    const Sentry = (await import(/* @vite-ignore */ mod)) as {
      init: (opts: Record<string, unknown>) => void
    }
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'
      ),
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    })
  } catch {
    // @sentry/nextjs 미설치 — 무시.
  }
}

void initClientSentry()
