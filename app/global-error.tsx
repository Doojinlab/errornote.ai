'use client'

// #50 — 루트 레벨 글로벌 에러 바운더리.
// 렌더 트리 최상단(루트 레이아웃 포함)에서 발생한 오류를 잡아 보고한다.
// NEXT_PUBLIC_SENTRY_DSN 이 있고 @sentry/nextjs 가 설치되어 있으면 브라우저 Sentry 로
// 전송하고, 아니면 콘솔로 폴백한다(instrumentation-client.ts 와 동일한 옵션 의존성 패턴).
//
// global-error 는 루트 레이아웃을 대체하므로 자체 <html>/<body> 를 렌더해야 하며,
// next-intl 컨텍스트 밖이라 번역 훅을 쓸 수 없다(고정 문자열 사용).

import { useEffect } from 'react'

function reportError(error: Error & { digest?: string }): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error('[global-error]', error)
    return
  }
  void (async () => {
    try {
      const mod = ['@sentry', 'nextjs'].join('/') // 정적 해석 회피
      const Sentry = (await import(/* @vite-ignore */ mod)) as {
        captureException?: (e: unknown, hint?: unknown) => void
      }
      if (Sentry.captureException) {
        Sentry.captureException(error, { extra: { digest: error.digest } })
      } else {
        console.error('[global-error]', error)
      }
    } catch {
      console.error('[global-error]', error)
    }
  })()
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <p style={{ fontSize: 48, margin: '0 0 0.5rem' }}>⚠️</p>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 0.5rem' }}>
            문제가 발생했습니다
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 1.5rem' }}>
            예기치 못한 오류로 화면을 표시하지 못했습니다. 잠시 후 다시
            시도해 주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: '#6366f1',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
