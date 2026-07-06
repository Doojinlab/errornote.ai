'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, LipButton } from '@/components/student-ui'
import type { ReviewDetail } from '@/types/peer-review'

function ScoreSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-bold text-bodytx">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-xl2 border text-sm font-bold transition
              ${
                value === n
                  ? 'border-blue bg-blue text-white'
                  : 'border-hairline bg-white text-bodytx hover:border-blue'
              }
              disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PeerReviewFormPage() {
  const t = useTranslations('pages.student.peerReviewForm')
  const params   = useParams()
  const router   = useRouter()
  const reviewId = params?.id as string

  const [detail,     setDetail]     = useState<ReviewDetail | null>(null)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg,   setSavedMsg]   = useState(false)

  const [feedbackText,  setFeedbackText]  = useState('')
  const [grammarScore,  setGrammarScore]  = useState(0)
  const [vocabScore,    setVocabScore]    = useState(0)
  const [contentScore,  setContentScore]  = useState(0)
  const [overallScore,  setOverallScore]  = useState(0)

  useEffect(() => {
    if (!reviewId) return
    fetch(`/api/peer-review/${reviewId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) { setLoadError(body.error); return }
        const d: ReviewDetail = body.data
        setDetail(d)
        setFeedbackText(d.feedback_text  ?? '')
        setGrammarScore(d.grammar_score  ?? 0)
        setVocabScore(d.vocab_score      ?? 0)
        setContentScore(d.content_score  ?? 0)
        setOverallScore(d.overall_score  ?? 0)
      })
      .catch(() => setLoadError(t('loadFailed')))
      .finally(() => setLoading(false))
  }, [reviewId, t])

  const handleSave = useCallback(async () => {
    setFormError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/peer-review/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_text: feedbackText,
          grammar_score: grammarScore || undefined,
          vocab_score:   vocabScore   || undefined,
          content_score: contentScore || undefined,
          overall_score: overallScore || undefined,
        }),
      })
      const body = await res.json()
      if (body.error) { setFormError(body.error); return }
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } catch {
      setFormError(t('saveDraft') + ' ' + t('loadFailed'))
    } finally {
      setSaving(false)
    }
  }, [reviewId, feedbackText, grammarScore, vocabScore, contentScore, overallScore, t])

  const handleSubmit = useCallback(async () => {
    setFormError(null)
    if (!grammarScore || !vocabScore || !contentScore || !overallScore) {
      setFormError(t('validationScores'))
      return
    }
    if (!feedbackText.trim()) {
      setFormError(t('validationFeedback'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/peer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:           'submit',
          review_id:      reviewId,
          feedback_text:  feedbackText,
          grammar_score:  grammarScore,
          vocab_score:    vocabScore,
          content_score:  contentScore,
          overall_score:  overallScore,
        }),
      })
      const body = await res.json()
      if (body.error) { setFormError(body.error); return }
      router.push('/peer-review')
    } catch {
      setFormError(t('loadFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [reviewId, feedbackText, grammarScore, vocabScore, contentScore, overallScore, router, t])

  if (loading) {
    return <p className="text-sm text-muted">{t('loading')}</p>
  }

  if (loadError || !detail) {
    return <p className="text-sm text-terra-dark">{loadError ?? t('notFound')}</p>
  }

  const isCompleted = detail.status === 'completed'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{t('formTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{detail.assignment_title}</p>
      </div>

      {detail.prompt_text && (
        <section className="rounded-xl2 border border-hairline bg-ivory p-3">
          <p className="mb-1 text-xs font-bold text-muted">{t('promptLabel')}</p>
          <p className="whitespace-pre-wrap text-sm text-bodytx">{detail.prompt_text}</p>
        </section>
      )}

      <Card className="p-3">
        <p className="mb-1 text-xs font-bold text-muted">{t('draftLabel')}</p>
        {detail.draft_text ? (
          <p className="whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">
            {detail.draft_text}
          </p>
        ) : (
          <p className="text-sm text-muted">{t('draftMissing')}</p>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <p className="text-sm font-bold text-bodytx">{t('scoresHeading')}</p>

        <ScoreSelect label={t('grammarLabel')} value={grammarScore} onChange={setGrammarScore} disabled={isCompleted} />
        <ScoreSelect label={t('vocabLabel')}   value={vocabScore}   onChange={setVocabScore}   disabled={isCompleted} />
        <ScoreSelect label={t('contentLabel')} value={contentScore} onChange={setContentScore} disabled={isCompleted} />
        <ScoreSelect label={t('overallLabel')} value={overallScore} onChange={setOverallScore} disabled={isCompleted} />

        <div className="space-y-1">
          <label htmlFor="feedback-text" className="text-sm font-bold text-bodytx">
            {t('feedbackLabel')}
          </label>
          <textarea
            id="feedback-text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            disabled={isCompleted}
            rows={5}
            placeholder={t('feedbackPlaceholder')}
            className="w-full rounded-xl2 border border-hairline p-2 text-sm text-bodytx
              placeholder-muted focus:border-blue focus:outline-none
              disabled:bg-ivory disabled:opacity-70"
          />
        </div>

        {formError && <p className="text-sm text-terra-dark">{formError}</p>}
        {savedMsg  && <p className="text-sm text-jade-dark">{t('savedMsg')}</p>}

        {!isCompleted ? (
          <div className="flex gap-2">
            <LipButton
              variant="white"
              onClick={handleSave}
              className={saving || submitting ? 'pointer-events-none opacity-50' : ''}
            >
              {saving ? t('saving') : t('saveDraft')}
            </LipButton>
            <LipButton
              variant="blue"
              onClick={handleSubmit}
              className={saving || submitting ? 'pointer-events-none opacity-50' : ''}
            >
              {submitting ? t('submitting') : t('submitReview')}
            </LipButton>
          </div>
        ) : (
          <div className="rounded-xl2 bg-jade-soft p-3 text-sm text-jade-dark">
            {t('completedMsg')}
          </div>
        )}
      </Card>
    </div>
  )
}
