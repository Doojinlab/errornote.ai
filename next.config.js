const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// 모든 응답에 적용하는 기본 보안 헤더. X-Frame-Options 는 별도 처리(LTI iframe 임베드 예외).
const baseSecurityHeaders = [
  // HSTS — HTTPS 강제(Vercel 은 전 구간 HTTPS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 배럴 임포트(lucide-react 아이콘 등)를 실제 사용한 모듈만 남기도록 최적화해
  // 학생 셸·에디터 경로의 클라이언트 번들 크기와 초기 로드를 줄인다.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      // 1) 전 경로 공통 보안 헤더(프레이밍 정책 제외).
      { source: '/:path*', headers: baseSecurityHeaders },
      // 2) LTI 런치는 LMS iframe 임베드가 필요하므로 X-Frame-Options:DENY 를 적용하지 않는다.
      //    /api/lti 를 제외한 모든 경로에만 클릭재킹 방어로 DENY 적용(negative lookahead).
      {
        source: '/((?!api/lti).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      // 3) /api/lti 경로는 LMS 플랫폼의 프레이밍을 허용(frame-ancestors).
      {
        source: '/api/lti/:path*',
        headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
