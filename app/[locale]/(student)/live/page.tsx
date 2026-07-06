// Phase 4-A — 학생 라이브 수업 진입점: 수강 중 클래스 목록 + 활성 세션 표시.
// [창] feat/phase4-live-class

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'

interface EnrollmentJoin {
  class_id: string
  classes: {
    id: string
    name: string
    semester: string
    is_active: boolean
    current_grammar_focus: string | null
  } | null
}

interface ActiveSessionRow {
  class_id: string
  id: string
}

export const dynamic = 'force-dynamic'

export default async function StudentLivePickerPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'student') redirect('/dashboard')

  const t = await getTranslations('pages.student.live')
  const supabase = createServerClient()

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id, classes(id, name, semester, is_active, current_grammar_focus)')
    .eq('student_id', auth.userId)

  const rows = ((enrollments as EnrollmentJoin[] | null) ?? []).filter(
    (r) => r.classes !== null
  )

  // 활성 세션이 있는 class id 집합 — 학생측 RLS 가 live_sessions 에 select 를 주지 않을 수 있으므로
  // 실패 시 빈 집합으로 폴백한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeRaw } = await (supabase as any)
    .from('live_sessions')
    .select('class_id, id')
    .is('ended_at', null)
  const activeByClass = new Set(
    ((activeRaw as ActiveSessionRow[] | null) ?? []).map((s) => s.class_id)
  )

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{t('pickerTitle')}</h1>
        <p className="mt-1 text-xs text-muted">{t('pickerSubtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl2 border border-hairline bg-white p-6 text-sm text-muted">
          {t('emptyClasses')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const c = r.classes!
            const live = activeByClass.has(c.id)
            return (
              <li key={c.id}>
                <Link
                  href={`/live/${c.id}`}
                  className="card-pop block rounded-xl3 border border-hairline bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-ink">{c.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        live
                          ? 'bg-terra-soft text-terra-dark'
                          : 'bg-blue-soft text-blue-dark'
                      }`}
                    >
                      {live ? t('badgeLive') : t('badgeIdle')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.semester}</p>
                  <p className="mt-2 text-xs font-bold text-blue">
                    {t('enterRoom')} →
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
