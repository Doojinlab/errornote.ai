/**
 * 정적 미디어 자산(영상 등)의 베이스 URL 헬퍼.
 *
 * `NEXT_PUBLIC_ASSET_BASE_URL` 이 설정되면(예: Vercel Blob/CDN 도메인) 해당 베이스에서
 * 자산을 로드하고, 미설정 시 로컬 `/public` 경로를 그대로 사용한다(기존 동작 유지).
 * 대용량 영상(hero.mp4 / feature.mp4)을 CDN 으로 옮긴 뒤 env 만 설정하면 코드 변경 없이
 * 전환된다. 값은 빌드 시 인라인되므로(NEXT_PUBLIC_) 클라이언트에서도 안전하게 사용 가능.
 *
 * @example
 *   NEXT_PUBLIC_ASSET_BASE_URL=https://cdn.errornote.ai 이면
 *   assetUrl('/video/hero.mp4') → 'https://cdn.errornote.ai/video/hero.mp4'
 *   미설정 시 → '/video/hero.mp4'
 */
const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

export function assetUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return ASSET_BASE ? `${ASSET_BASE}${p}` : p
}
