'use client'

// Phase 4-A — 학생 라이브 룸 클라이언트.
// [창] feat/phase4-live-class
//
// 흐름:
//   1. 동의 안 됨 → 모달 노출. 동의 시 /api/live/typing-consent 로 영속.
//   2. 동의 후 → textarea 활성화, 1s debounce 로 broadcast 송출.
//   3. 'control:ended' 수신 시 textarea 잠금 + 안내.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createLiveTypingPublisher,
  subscribeToLiveTyping,
  type LiveTypingPublisher
} from '@/lib/live-broadcast'
import type { LiveControlPayload } from '@/types/live'

export interface LiveStudentRoomLabels {
  title: string
  focusLine: string
  consentTitle: string
  consentBody: string
  consentAccept: string
  consentDecline: string
  consentSaving: string
  consentRetry: string
  statusLive: string
  statusIdle: string
  statusEnded: string
  textareaLabel: string
  textareaPlaceholder: string
  broadcastingHint: string
  consentWithdraw: string
  consentRegrant: string
  notConsentedBlock: string
}

interface Props {
  classId: string
  studentId: string
  studentName: string
  initialConsented: boolean
  labels: LiveStudentRoomLabels
}

type SessionState = 'idle' | 'live' | 'ended'

export default function LiveStudentRoom({
  classId,
  studentId,
  studentName,
  initialConsented,
  labels
}: Props) {
  const [consented, setConsented] = useState(initialConsented)
  const [showModal, setShowModal] = useState(!initialConsented)
  const [savingConsent, setSavingConsent] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sessionState, setSessionState] = useState<SessionState>('idle')

  const publisherRef = useRef<LiveTypingPublisher | null>(null)

  // control 신호 수신 (수업 시작/종료) — 동의 여부와 무관하게 항상 켠다.
  useEffect(() => {
    const unsub = subscribeToLiveTyping({
      classId,
      onControl: (payload: LiveControlPayload) => {
        if (payload.type === 'started') setSessionState('live')
        else if (payload.type === 'ended') setSessionState('ended')
      }
    })
    return unsub
  }, [classId])

  // 동의 후 publisher 생성/해제
  useEffect(() => {
    if (!consented) return
    const pub = createLiveTypingPublisher({
      classId,
      studentId,
      studentName,
      debounceMs: 1000
    })
    publisherRef.current = pub
    return () => {
      pub.close()
      publisherRef.current = null
    }
  }, [consented, classId, studentId, studentName])

  const handleAcceptConsent = useCallback(async () => {
    setSavingConsent(true)
    setConsentError(null)
    try {
      const res = await fetch('/api/live/typing-consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, granted: true })
      })
      if (!res.ok) throw new Error(await res.text())
      setConsented(true)
      setShowModal(false)
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : 'consent failed')
    } finally {
      setSavingConsent(false)
    }
  }, [classId])

  const handleDeclineConsent = useCallback(() => {
    setShowModal(false)
  }, [])

  const handleWithdraw = useCallback(async () => {
    setSavingConsent(true)
    setConsentError(null)
    try {
      const res = await fetch('/api/live/typing-consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, granted: false })
      })
      if (!res.ok) throw new Error(await res.text())
      // 동의 철회 — debounce 우회, 즉시 빈 본문 송출 후 publisher 종료(useEffect cleanup).
      publisherRef.current?.publishImmediate('')
      setText('')
      setConsented(false)
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : 'withdraw failed')
    } finally {
      setSavingConsent(false)
    }
  }, [classId])

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value
      setText(v)
      // 동의가 살아있는 동안에는 항상 broadcast 한다. session idle/ended 여부는 교수 화면에서 판별.
      if (consented) {
        publisherRef.current?.publish(v)
      }
    },
    [consented]
  )

  const statusBadge =
    sessionState === 'live'
      ? labels.statusLive
      : sessionState === 'ended'
      ? labels.statusEnded
      : labels.statusIdle

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{labels.title}</h1>
          <p className="mt-0.5 text-xs text-muted">{labels.focusLine}</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-bold ${
            sessionState === 'live'
              ? 'bg-terra-soft text-terra-dark'
              : sessionState === 'ended'
              ? 'bg-hairline text-muted'
              : 'bg-blue-soft text-blue-dark'
          }`}
        >
          {statusBadge}
        </span>
      </header>

      {!consented && !showModal && (
        <div className="rounded-xl2 border border-gold-soft bg-gold-soft p-4 text-sm text-gold-dark">
          <p className="mb-3">{labels.notConsentedBlock}</p>
          <button
            onClick={() => setShowModal(true)}
            disabled={savingConsent}
            className="rounded-xl2 bg-gold px-4 py-2 text-sm font-bold text-white hover:bg-gold-dark disabled:opacity-50"
          >
            {labels.consentRegrant}
          </button>
        </div>
      )}

      {consented && (
        <section className="space-y-2">
          <label
            htmlFor="live-text"
            className="block text-xs font-bold text-bodytx"
          >
            {labels.textareaLabel}
          </label>
          <textarea
            id="live-text"
            value={text}
            onChange={handleTextChange}
            disabled={sessionState === 'ended'}
            placeholder={labels.textareaPlaceholder}
            className="block min-h-[200px] w-full resize-y rounded-xl2 border border-hairline bg-white p-3 font-cn text-sm shadow-sm focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue-soft disabled:bg-ivory"
            maxLength={4000}
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {sessionState === 'live'
                ? labels.broadcastingHint
                : sessionState === 'ended'
                ? labels.statusEnded
                : labels.statusIdle}
            </span>
            <button
              onClick={handleWithdraw}
              disabled={savingConsent}
              className="text-xs text-terra-dark hover:underline disabled:opacity-50"
            >
              {labels.consentWithdraw}
            </button>
          </div>
        </section>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl3 border border-hairline bg-white p-6 shadow-xl">
            <h2 className="text-base font-extrabold text-ink">
              {labels.consentTitle}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-bodytx">
              {labels.consentBody}
            </p>
            {consentError && (
              <p className="mt-3 text-xs text-terra-dark">{consentError}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={handleDeclineConsent}
                disabled={savingConsent}
                className="rounded-xl2 border border-hairline px-4 py-2 text-sm text-bodytx hover:bg-ivory disabled:opacity-50"
              >
                {labels.consentDecline}
              </button>
              <button
                onClick={handleAcceptConsent}
                disabled={savingConsent}
                className="rounded-xl2 bg-blue px-4 py-2 text-sm font-bold text-white hover:bg-blue-dark disabled:opacity-50"
              >
                {savingConsent ? labels.consentSaving : labels.consentAccept}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
