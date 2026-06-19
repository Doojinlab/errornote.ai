import { describe, it, expect } from 'vitest'
import {
  isIos,
  isIosSafari,
  isStandalone,
  isDismissed,
  decidePromptMode,
  PWA_DISMISS_KEY,
} from './pwa-install'

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

describe('isIos / isIosSafari', () => {
  it('iOS UA 판별', () => {
    expect(isIos(IOS_SAFARI)).toBe(true)
    expect(isIos(ANDROID_CHROME)).toBe(false)
  })
  it('iOS Safari 만 안내 대상(iOS Chrome 제외)', () => {
    expect(isIosSafari(IOS_SAFARI)).toBe(true)
    expect(isIosSafari(IOS_CHROME)).toBe(false)
    expect(isIosSafari(ANDROID_CHROME)).toBe(false)
  })
})

describe('isStandalone', () => {
  it('display-mode standalone 또는 navigator.standalone', () => {
    expect(isStandalone({ displayStandalone: true })).toBe(true)
    expect(isStandalone({ displayStandalone: false, navigatorStandalone: true })).toBe(true)
    expect(isStandalone({ displayStandalone: false, navigatorStandalone: false })).toBe(false)
    expect(isStandalone({ displayStandalone: false })).toBe(false)
  })
})

describe('isDismissed', () => {
  it("저장된 값이 '1' 이면 디스미스", () => {
    expect(isDismissed((k) => (k === PWA_DISMISS_KEY ? '1' : null))).toBe(true)
    expect(isDismissed(() => null)).toBe(false)
    expect(isDismissed(() => '0')).toBe(false)
  })
})

describe('decidePromptMode', () => {
  const base = { standalone: false, dismissed: false, canInstall: false, iosSafari: false }
  it('설치됨/디스미스면 none', () => {
    expect(decidePromptMode({ ...base, standalone: true, canInstall: true })).toBe('none')
    expect(decidePromptMode({ ...base, dismissed: true, iosSafari: true })).toBe('none')
  })
  it('canInstall 이면 install (iOS보다 우선)', () => {
    expect(decidePromptMode({ ...base, canInstall: true })).toBe('install')
    expect(decidePromptMode({ ...base, canInstall: true, iosSafari: true })).toBe('install')
  })
  it('iOS Safari 면 ios-guide', () => {
    expect(decidePromptMode({ ...base, iosSafari: true })).toBe('ios-guide')
  })
  it('해당 없으면 none', () => {
    expect(decidePromptMode(base)).toBe('none')
  })
})
