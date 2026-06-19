// 웹 푸시 구독 클라이언트 헬퍼 (#86).
// 브라우저 API(Notification/serviceWorker/PushManager) 의존 값은 컴포넌트에서 주입받고,
// 여기서는 순수 변환/판별만 둬 단위 테스트한다. (lib/pwa-install.ts 와 동일 패턴)

/** VAPID 공개키(base64url) → applicationServerKey(Uint8Array). 순수 변환. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary')
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export type PushUiState =
  | 'unsupported' // 브라우저가 푸시 미지원 또는 VAPID 키 미설정
  | 'ios-needs-install' // iOS Safari — 홈 화면에 설치해야 푸시 가능(16.4+)
  | 'blocked' // 사용자가 알림 권한을 차단함
  | 'enabled' // 이미 구독 중
  | 'prompt' // 구독 가능(활성화 버튼 노출)

/**
 * 푸시 토글 UI 상태 결정(순수).
 * iOS 는 홈 화면 설치(standalone) 상태에서만 웹 푸시가 동작하므로, 미설치 iOS Safari 는
 * 설치 안내로 분기한다(#86 iOS 설치형 푸시 안내).
 */
export function decidePushUiState(opts: {
  supported: boolean
  iosSafari: boolean
  standalone: boolean
  permission: NotificationPermission
  subscribed: boolean
}): PushUiState {
  if (!opts.supported) return 'unsupported'
  if (opts.iosSafari && !opts.standalone) return 'ios-needs-install'
  if (opts.subscribed) return 'enabled'
  if (opts.permission === 'denied') return 'blocked'
  return 'prompt'
}
