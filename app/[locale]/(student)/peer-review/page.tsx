import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/lib/auth'
import { listAssignedReviews, listReceivedReviews } from '@/lib/peer-review'
import { Card } from '@/components/student-ui'
import type { ReviewStatus } from '@/types/peer-review'

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending:     'bg-gold-soft text-gold-dark',
  in_progress: 'bg-blue-soft text-blue-dark',
  completed:   'bg-jade-soft text-jade-dark',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default async function PeerReviewPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [t, assigned, received] = await Promise.all([
    getTranslations('pages.student.peerReview'),
    listAssignedReviews(user.id),
    listReceivedReviews(user.id),
  ])

  const pending = assigned.filter((r) => r.status !== 'completed')
  const done    = assigned.filter((r) => r.status === 'completed')

  const STATUS_LABEL: Record<ReviewStatus, string> = {
    pending:     t('statusPending'),
    in_progress: t('statusInProgress'),
    completed:   t('statusCompleted'),
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">{t('title')}</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-bodytx">
          {t('pendingTitle', { count: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl2 border border-dashed border-hairline bg-white p-6 text-center text-sm text-muted">
            {t('pendingEmpty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.review_id}>
                <Link href={`/peer-review/${r.review_id}`}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-ink">{r.assignment_title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t('assignedDate', { date: formatDate(r.created_at) })}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-bodytx">
            {t('doneTitle', { count: done.length })}
          </h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.review_id}>
                <Card className="p-3 opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-bodytx">{r.assignment_title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR.completed}`}>
                      {STATUS_LABEL.completed}
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-bodytx">
          {t('receivedTitle', { count: received.length })}
        </h2>
        {received.length === 0 ? (
          <p className="rounded-xl2 border border-dashed border-hairline bg-white p-6 text-center text-sm text-muted">
            {t('receivedEmpty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {received.map((req) => {
              const completedReviews = req.reviews.filter((rv) => rv.status === 'completed')
              return (
                <li key={req.request_id}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-ink">{req.assignment_title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[req.request_status]}`}
                      >
                        {STATUS_LABEL[req.request_status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t('requestDate', { date: formatDate(req.request_created_at) })}
                    </p>

                    {completedReviews.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {completedReviews.map((rv, i) => (
                          <div key={rv.id} className="rounded-xl2 bg-ivory p-2 text-sm">
                            <p className="mb-1 text-xs font-bold text-bodytx">
                              {t('feedbackLabel', { num: i + 1 })}
                            </p>
                            {rv.feedback_text && (
                              <p className="mb-2 whitespace-pre-wrap text-bodytx">{rv.feedback_text}</p>
                            )}
                            <div className="flex flex-wrap gap-3">
                              {rv.grammar_score !== null && (
                                <span className="text-xs text-muted">
                                  {t('scoreGrammar')} <strong className="text-ink">{rv.grammar_score}</strong>/5
                                </span>
                              )}
                              {rv.vocab_score !== null && (
                                <span className="text-xs text-muted">
                                  {t('scoreVocab')} <strong className="text-ink">{rv.vocab_score}</strong>/5
                                </span>
                              )}
                              {rv.content_score !== null && (
                                <span className="text-xs text-muted">
                                  {t('scoreContent')} <strong className="text-ink">{rv.content_score}</strong>/5
                                </span>
                              )}
                              {rv.overall_score !== null && (
                                <span className="text-xs text-muted">
                                  {t('scoreOverall')} <strong className="text-ink">{rv.overall_score}</strong>/5
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {req.request_status !== 'completed' && (
                      <p className="mt-2 text-xs text-muted">
                        {t('reviewerWorking')}
                      </p>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
