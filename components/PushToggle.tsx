'use client'

// 브라우저 웹 푸시 구독 토글 (#86).
// 서버 인프라(register/unregister RPC, sw.js push 핸들러, lib/webpush 발송)는 갖춰져 있었으나
// 클라이언트 구독 UX 가 없어 아무도 구독할 수 없었다. 이 컴포넌트가 그 흐름을 채운다.
//  - 지원/권한/구독 상태를 판별(lib/web-push-client.decidePushUiState).
//  - iOS Safari 미설치 → 홈 화면 설치 안내(iOS 는 설치형 PWA 에서만 푸시 가능, 16.4+).
//  - 활성화: 권한 요청 → pushManager.subscribe(VAPID) → register_push_subscription RPC.
//  - 해제: 구독 unsubscribe → unregister_push_subscription RPC.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { Database, Json } from '@/types/database'
import { isIosSafari, isStandalone } from '@/lib/pwa-install'
import {
  decidePushUiState,
  urlBase64ToUint8Array,
  type PushUiState,
} from '@/lib/web-push-client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

export default function PushToggle() {
  const t = useTranslations('pages.student.notifications.push')
  // ssr/supabase-js 타입 미스매치(#53)로 ssr 브라우저 클라이언트의 .rpc() Args 가 깨진다.
  // 정식 SupabaseClient<Database> 로 좁혀 register/unregister RPC 를 타입 안전하게 호출한다.
  const supabase = useMemo(
    () => createBrowserClient() as unknown as SupabaseClient<Database>,
    []
  )
  const [state, setState] = useState<PushUiState>('unsupported')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supported = pushSupported()
    const iosSafari = isIosSafari(navigator.userAgent)
    const standalone = isStandalone({
      displayStandalone:
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    })
    let subscribed = false
    if (supported) {
      try {
        const reg = await navigator.serviceWorker.ready
        subscribed = (await reg.pushManager.getSubscription()) !== null
      } catch {
        /* SW 준비 실패 시 미구독으로 간주 */
      }
    }
    const permission = supported ? Notification.permission : 'default'
    setState(decidePushUiState({ supported, iosSafari, standalone, permission, subscribed }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        await refresh()
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as BufferSource,
      })
      const json = sub.toJSON() as { endpoint?: string }
      const { error: rpcErr } = await supabase.rpc('register_push_subscription', {
        p_endpoint: json.endpoint ?? sub.endpoint,
        p_subscription: json as unknown as Json,
      })
      if (rpcErr) throw new Error(rpcErr.message)
      setState('enabled')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failed'))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await supabase.rpc('unregister_push_subscription', { p_endpoint: endpoint })
      }
      setState('prompt')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failed'))
    } finally {
      setBusy(false)
    }
  }

  // 미지원 환경에서는 섹션 자체를 숨겨 잡음을 줄인다.
  if (state === 'unsupported') return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t('title')}</p>
          <p className="text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        {state === 'enabled' && (
          <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
            {t('onBadge')}
          </span>
        )}
      </div>

      {state === 'ios-needs-install' && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          {t('iosNeedsInstall')}
        </p>
      )}

      {state === 'blocked' && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {t('blocked')}
        </p>
      )}

      {state === 'prompt' && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? t('working') : t('enable')}
        </button>
      )}

      {state === 'enabled' && (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? t('working') : t('disable')}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
