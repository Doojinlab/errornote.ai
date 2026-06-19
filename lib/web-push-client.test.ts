import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array, decidePushUiState } from './web-push-client'

describe('urlBase64ToUint8Array', () => {
  it('base64url(VAPID) 을 Uint8Array 로 변환한다', () => {
    // "hello" → base64 "aGVsbG8" (url-safe, 패딩 없음)
    const out = urlBase64ToUint8Array('aGVsbG8')
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]) // h e l l o
  })

  it('url-safe 문자(-, _)를 표준 base64(+, /)로 되돌려 디코드한다', () => {
    // 0xFB 0xFF 0xBF → base64 "+/+/" → url-safe "-_-_"
    const out = urlBase64ToUint8Array('-_-_')
    expect(Array.from(out)).toEqual([251, 255, 191])
  })
})

describe('decidePushUiState', () => {
  const base = {
    supported: true,
    iosSafari: false,
    standalone: false,
    permission: 'default' as NotificationPermission,
    subscribed: false,
  }

  it('미지원 → unsupported', () => {
    expect(decidePushUiState({ ...base, supported: false })).toBe('unsupported')
  })

  it('iOS Safari 미설치 → ios-needs-install', () => {
    expect(decidePushUiState({ ...base, iosSafari: true, standalone: false })).toBe(
      'ios-needs-install'
    )
  })

  it('iOS Safari 설치(standalone) → 정상 흐름(prompt)', () => {
    expect(decidePushUiState({ ...base, iosSafari: true, standalone: true })).toBe('prompt')
  })

  it('이미 구독 중 → enabled', () => {
    expect(decidePushUiState({ ...base, subscribed: true })).toBe('enabled')
  })

  it('권한 차단 → blocked', () => {
    expect(decidePushUiState({ ...base, permission: 'denied' })).toBe('blocked')
  })

  it('기본(지원·미구독·권한 default) → prompt', () => {
    expect(decidePushUiState(base)).toBe('prompt')
  })

  it('구독 상태가 권한 차단보다 우선(enabled)', () => {
    expect(decidePushUiState({ ...base, subscribed: true, permission: 'denied' })).toBe('enabled')
  })
})
