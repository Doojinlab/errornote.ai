'use client'

// PWA 설치 유도 배너 (#86). A(PWA-우선) 전략의 설치 전환 UX.
//  - Android/Chrome: beforeinstallprompt 가로채 커스텀 "설치" 버튼 제공.
//  - iOS Safari: 설치 프롬프트 미지원 → "공유 → 홈 화면에 추가" 안내(+ 설치형 푸시 안내).
//  - 이미 설치(standalone)이거나 사용자가 닫으면 표시하지 않음(localStorage 기억).

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  PWA_DISMISS_KEY,
  decidePromptMode,
  isDismissed,
  isIosSafari,
  isStandalone,
  type PromptMode,
} from '@/lib/pwa-install'
import { sendClientMetric } from '@/lib/client-metrics'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallPrompt() {
  const t = useTranslations('pages.components.pwaInstall')
  const [mode, setMode] = useState<PromptMode>('none')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  // 노출 메트릭은 모드별 1회만 — 같은 배너 재렌더로 중복 집계되지 않도록 기억한다.
  const shownRef = useRef<PromptMode | null>(null)

  // 배너가 실제로 보이는 모드로 바뀌면 노출 전환 메트릭을 1회 전송한다(#86).
  useEffect(() => {
    if ((mode === 'install' || mode === 'ios-guide') && shownRef.current !== mode) {
      shownRef.current = mode
      sendClientMetric('pwa_install_prompt_shown', { mode })
    }
  }, [mode])

  useEffect(() => {
    const standalone = isStandalone({
      displayStandalone:
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    })
    const dismissed = isDismissed((k) => {
      try {
        return localStorage.getItem(k)
      } catch {
        return null
      }
    })
    const iosSafari = isIosSafari(navigator.userAgent)

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라이언트 전용 판별(standalone/UA)을 마운트 후 1회 반영
    setMode(decidePromptMode({ standalone, dismissed, canInstall: false, iosSafari }))

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      if (!standalone && !dismissed) setMode('install')
    }
    const onInstalled = () => setMode('none')

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    sendClientMetric('pwa_install_dismissed', { source: 'banner', mode })
    try {
      localStorage.setItem(PWA_DISMISS_KEY, '1')
    } catch {
      // 저장 실패는 무시(세션 동안만 닫힘)
    }
    setMode('none')
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    sendClientMetric(
      choice.outcome === 'accepted' ? 'pwa_install_accepted' : 'pwa_install_dismissed',
      { source: 'prompt' }
    )
    setDeferred(null)
    setMode('none')
  }

  if (mode === 'none') return null

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t('title')}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            {mode === 'install' ? t('installBody') : t('iosBody')}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {mode === 'install' && (
              <button
                type="button"
                onClick={install}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {t('installCta')}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
