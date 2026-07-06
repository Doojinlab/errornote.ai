// Phase 4-B — 학생 주간 학습 제안 목록.
// [창] feat/phase4-weekly-report
// NAV 노출은 PR #21 머지 후 별도 PR. 그 전엔 /weekly-suggestions 직접 URL 접근.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAuthContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { StudentWeeklyMetrics, StudentWeeklySuggestions } from '@/types/weekly-reports'

interface RowJoin {
  id: string
  class_id: string
  week_start: string
  metrics: unknown
  suggestions: unknown
  created_at: string
  classes: { name: string } | { name: string }[] | null
}

export const dynamic = 'force-dynamic'

export default async function StudentWeeklySuggestionsListPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'student') redirect('/dashboard')

  const t = await getTranslations('pages.student.weeklySuggestions')
  const supabase = createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowsRaw } = await (supabase as any)
    .from('student_weekly_reports')
    .select('id, class_id, week_start, metrics, suggestions, created_at, classes(name)')
    .eq('student_id', auth.userId)
    .order('week_start', { ascending: false })
    .limit(20)
  const rows = (rowsRaw as RowJoin[] | null) ?? []

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-ink">{t('title')}</h1>
        <p className="mt-0.5 text-xs text-muted">{t('subtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <p className="card-pop rounded-xl2 border border-hairline bg-white p-6 text-sm text-muted">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const klass = Array.isArray(r.classes) ? r.classes[0] : r.classes
            const className = klass?.name ?? ''
            const suggestions = (r.suggestions ?? {
              headline: ''
            }) as StudentWeeklySuggestions
            const metrics = (r.metrics ?? {
              total_sessions: 0,
              total_errors: 0
            }) as StudentWeeklyMetrics
            return (
              <li key={r.id}>
                <Link
                  href={`/weekly-suggestions/${r.week_start}/${r.class_id}`}
                  className="card-pop block rounded-xl2 border border-hairline bg-white p-4 transition-colors hover:border-blue hover:bg-blue-soft/40"
                >
                  <p className="text-xs text-muted">
                    {t('weekOf', { date: r.week_start })}
                    {className && ` · ${className}`}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {suggestions.headline || t('noHeadline')}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {t('summary', {
                      sessions: metrics.total_sessions,
                      errors: metrics.total_errors
                    })}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
