'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createBrowserClient } from '@/lib/supabase-browser'
import PushToggle from '@/components/PushToggle'
import type { KakaoConnectionStatus, KakaoEnabledEvents, KakaoEventType } from '@/types/kakao'

const EVENT_TYPES: KakaoEventType[] = [
  'assignment_created',
  'feedback_received',
  'badge_earned',
  'peer_review_assigned',
]

const DEFAULT_ENABLED: KakaoEnabledEvents = {
  assignment_created: true,
  feedback_received: true,
  badge_earned: true,
  peer_review_assigned: true,
}

interface Toast {
  type: 'success' | 'error'
  message: string
}

export default function NotificationsPage() {
  const t = useTranslations('pages.student.notifications')
  const supabase = createBrowserClient()
  const [status, setStatus] = useState<KakaoConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  const eventLabel = (event: KakaoEventType): string => {
    const map: Record<KakaoEventType, string> = {
      assignment_created: t('eventAssignmentCreated'),
      feedback_received: t('eventFeedbackReceived'),
      badge_earned: t('eventBadgeEarned'),
      peer_review_assigned: t('eventPeerReviewAssigned'),
    }
    return map[event]
  }

  function showToast(type: Toast['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/kakao')
      if (res.ok) {
        const data = (await res.json()) as KakaoConnectionStatus
        setStatus(data)
      }
    } catch {
      showToast('error', t('toastLoadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const kakaoResult = params.get('kakao')
    if (kakaoResult === 'connected') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- OAuth 콜백 URL 파라미터를 마운트 시 1회 처리
      showToast('success', t('toastConnected'))
      window.history.replaceState({}, '', '/notifications')
    } else if (kakaoResult === 'error') {
      showToast('error', t('toastConnectError'))
      window.history.replaceState({}, '', '/notifications')
    }
  }, [t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 데이터 로드(비동기 fetch)
    fetchStatus()
  }, [fetchStatus])

  function handleConnect() {
    window.location.href = '/api/notifications/kakao/connect'
  }

  async function handleUnlink() {
    if (!confirm(t('confirmUnlink'))) return
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/kakao/connect', { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? t('unlinkFailed'))
      }

      setStatus((prev) =>
        prev ? { ...prev, connected: false, kakao_user_id: null } : null
      )
      showToast('success', t('unlinkSuccess'))
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : t('unlinkFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEvent(event: KakaoEventType) {
    if (!status) return
    const prev = status.enabled_events
    const newEvents: KakaoEnabledEvents = { ...prev, [event]: !prev[event] }

    setStatus((s) => (s ? { ...s, enabled_events: newEvents } : null))
    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error(t('authRequired'))

      const { error } = await supabase
        .from('notification_settings')
        .upsert({ user_id: user.id, enabled_events: newEvents } as never, {
          onConflict: 'user_id',
        })

      if (error) throw new Error(error.message)
    } catch (err) {
      setStatus((s) => (s ? { ...s, enabled_events: prev } : null))
      showToast('error', err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted">{t('loading')}</p>
      </div>
    )
  }

  const events = status?.enabled_events ?? DEFAULT_ENABLED

  return (
    <main className="space-y-4">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl2 border px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'border-jade bg-jade-soft text-jade-dark'
              : 'border-terra bg-terra-soft text-terra-dark'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-lg font-bold text-ink">{t('title')}</h1>
        <p className="mt-0.5 text-xs text-muted">{t('subtitle')}</p>
      </div>

      <PushToggle />

      <section className="card-pop rounded-xl2 border border-hairline bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl2 bg-gold text-sm font-bold text-gold-dark select-none">
            K
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t('kakaoTitle')}</p>
            <p className="truncate text-xs text-muted">
              {status?.connected
                ? t('connectedStatus', { id: status.kakao_user_id ?? '' })
                : t('disconnectedStatus')}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
              status?.connected
                ? 'bg-jade-soft text-jade-dark'
                : 'bg-ivory text-muted'
            }`}
          >
            {status?.connected ? t('connectedBadge') : t('disconnectedBadge')}
          </span>
        </div>

        {status?.connected ? (
          <button
            onClick={handleUnlink}
            disabled={saving}
            className="w-full rounded-xl2 border border-terra py-2 text-sm text-terra
              transition-colors hover:bg-terra-soft disabled:opacity-50"
          >
            {t('unlink')}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={saving}
            className="w-full rounded-xl2 bg-gold py-2 text-sm font-medium text-gold-dark
              transition-colors hover:bg-gold-dark disabled:opacity-50"
          >
            {t('connect')}
          </button>
        )}
      </section>

      <section className="card-pop rounded-xl2 border border-hairline bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-ink">{t('eventsTitle')}</p>
        <p className="mb-4 text-xs text-muted">{t('eventsSubtitle')}</p>

        <ul className="divide-y divide-hairline">
          {EVENT_TYPES.map((event) => (
            <li key={event} className="flex items-center justify-between py-3">
              <span className="text-sm text-bodytx">{eventLabel(event)}</span>
              <button
                role="switch"
                aria-checked={events[event]}
                aria-label={eventLabel(event)}
                onClick={() => handleToggleEvent(event)}
                disabled={saving || !status?.connected}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue
                  disabled:opacity-40 ${events[event] ? 'bg-blue' : 'bg-hairline'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    events[event] ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>

        {!status?.connected && (
          <p className="mt-3 text-xs text-muted">{t('eventsHint')}</p>
        )}
      </section>
    </main>
  )
}
