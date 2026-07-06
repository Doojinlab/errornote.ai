import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { LipButton } from '@/components/student-ui'
import { requireAuth, AuthError } from '@/lib/auth'
import { getPronunciationStats } from '@/lib/pronunciation'
import type { PronunciationSession } from '@/types/pronunciation'

// 점수 밴드별 토큰 매핑 — 인라인 hex 금지, 정적 클래스 문자열만 사용.
type ScoreBand = 'jade' | 'gold' | 'terra'
const scoreBand = (s: number): ScoreBand => (s >= 90 ? 'jade' : s >= 70 ? 'gold' : 'terra')
const SCORE_TEXT: Record<ScoreBand, string> = {
  jade: 'text-jade',
  gold: 'text-gold',
  terra: 'text-terra',
}
const SCORE_CHIP: Record<ScoreBand, string> = {
  jade: 'bg-jade-soft text-jade-dark',
  gold: 'bg-gold-soft text-gold-dark',
  terra: 'bg-terra-soft text-terra-dark',
}
const SCORE_BAR: Record<ScoreBand, string> = {
  jade: 'bg-jade',
  gold: 'bg-gold',
  terra: 'bg-terra',
}

export default async function PronunciationHistoryPage() {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect('/login')
    throw err
  }

  const [t, stats] = await Promise.all([
    getTranslations('pages.student.pronunciationHistory'),
    getPronunciationStats(auth.userId),
  ])

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const avgBand = scoreBand(stats.averageAccuracy)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-bodytx">{t('subtitle')}</p>
        </div>
        <Link
          href="/pronunciation"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-bodytx"
        >
          <ArrowLeft size={14} aria-hidden />
          {t('backLink')}
        </Link>
      </header>

      {/* 요약 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl2 border border-hairline bg-white p-3 text-center">
          <p className="text-xl font-extrabold text-ink">{stats.totalSessions}</p>
          <p className="mt-0.5 text-xs text-muted">{t('statSessions')}</p>
        </div>
        <div className="rounded-xl2 border border-hairline bg-white p-3 text-center">
          <p className="text-xl font-extrabold text-blue">{stats.averageAccuracy}%</p>
          <p className="mt-0.5 text-xs text-muted">{t('statAvgAccuracy')}</p>
        </div>
        <div className="rounded-xl2 border border-hairline bg-white p-3 text-center">
          <p className="text-xl font-extrabold text-jade">{stats.bestAccuracy}%</p>
          <p className="mt-0.5 text-xs text-muted">{t('statBest')}</p>
        </div>
      </div>

      {/* 평균 정확도 진행바 */}
      {stats.totalSessions > 0 && (
        <div className="rounded-xl2 border border-hairline bg-white px-4 py-3">
          <p className="mb-2 text-sm font-bold text-ink">{t('progressLabel')}</p>
          <div
            role="progressbar"
            aria-valuenow={stats.averageAccuracy}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 w-full overflow-hidden rounded-full bg-hairline"
          >
            <div
              className={`h-full rounded-full transition-all ${SCORE_BAR[avgBand]}`}
              style={{ width: `${stats.averageAccuracy}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>0%</span>
            <span className="font-bold text-bodytx">{stats.averageAccuracy}%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* 최근 세션 */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">{t('recentTitle')}</h2>
        {stats.recentSessions.length === 0 ? (
          <div className="rounded-xl2 border border-dashed border-hairline px-6 py-10 text-center">
            <p className="text-sm text-muted">{t('emptyState')}</p>
            <div className="mt-4 flex justify-center">
              <LipButton variant="blue" href="/pronunciation">
                {t('startPractice')}
              </LipButton>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {stats.recentSessions.map((session: PronunciationSession) => {
              const band = scoreBand(session.accuracy_score)
              return (
                <li key={session.id} className="rounded-xl2 border border-hairline bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold text-ink">{session.target_text}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDate(session.created_at)} · {session.language}
                      </p>
                      {session.errors.length > 0 && (
                        <p className={`mt-1 text-xs font-medium ${SCORE_TEXT[band]}`}>
                          {t('issueCount', { count: session.errors.length })}
                        </p>
                      )}
                    </div>
                    <div className={`shrink-0 rounded-full px-3 py-1 text-base font-extrabold ${SCORE_CHIP[band]}`}>
                      {session.accuracy_score}%
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
