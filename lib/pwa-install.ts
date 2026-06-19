// PWA 설치 유도 — 순수 판별 헬퍼 (#86).
// 브라우저 API 의존 값(UA/standalone/storage)은 인자로 주입받아 단위 테스트 가능하게 둔다.

export const PWA_DISMISS_KEY = 'pwa-install-dismissed'

export function isIos(ua: string): boolean {
  return /iphone|ipad|ipod/i.test(ua)
}

/** iOS Safari 여부 — 설치 프롬프트 미지원, "홈 화면에 추가" 안내 대상.
 *  iOS 내 비-Safari 브라우저(Chrome=CriOS 등)는 설치가 불가하므로 제외한다. */
export function isIosSafari(ua: string): boolean {
  if (!isIos(ua)) return false
  return !/crios|fxios|edgios|opios/i.test(ua)
}

export function isStandalone(opts: {
  displayStandalone: boolean
  navigatorStandalone?: boolean
}): boolean {
  return opts.displayStandalone || opts.navigatorStandalone === true
}

export function isDismissed(getItem: (k: string) => string | null): boolean {
  return getItem(PWA_DISMISS_KEY) === '1'
}

export type PromptMode = 'install' | 'ios-guide' | 'none'

/**
 * 표시 모드 결정(순수):
 * - 이미 설치(standalone) 또는 디스미스 → none
 * - beforeinstallprompt 사용 가능(canInstall) → install
 * - iOS Safari → ios-guide
 * - 그 외 → none
 */
export function decidePromptMode(opts: {
  standalone: boolean
  dismissed: boolean
  canInstall: boolean
  iosSafari: boolean
}): PromptMode {
  if (opts.standalone || opts.dismissed) return 'none'
  if (opts.canInstall) return 'install'
  if (opts.iosSafari) return 'ios-guide'
  return 'none'
}
