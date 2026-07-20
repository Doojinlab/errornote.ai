// Phase 4-B — 학생 인앱 알림 인박스. 헤더 🔔 진입점(app/[locale]/(student)/layout.tsx).

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Settings } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { getAuthContext } from '@/lib/auth'
import NotificationInbox from '@/components/NotificationInbox'

export const dynamic = 'force-dynamic'

export default async function StudentNotificationsInboxPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const t = await getTranslations('pages.student.notifications.inbox')

  return (
    <>
      {/* 알림 설정(카카오/푸시)으로 가는 링크 — 설정 페이지가 고아가 되지 않도록. */}
      <div className="mb-2 flex justify-end">
        <Link
          href="/notifications"
          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-white px-3 py-1 text-xs font-medium text-bodytx hover:bg-ivory"
        >
          <Settings size={13} aria-hidden />
          알림 설정
        </Link>
      </div>
      <NotificationInbox
      labels={{
        title: t('title'),
        subtitle: t('subtitle'),
        empty: t('empty'),
        emptyUnread: t('emptyUnread'),
        loading: t('loading'),
        refresh: t('refresh'),
        markAll: t('markAll'),
        marking: t('marking'),
        filterAll: t('filterAll'),
        filterUnread: t('filterUnread'),
        open: t('open'),
        unread: t('unread'),
        loadError: t('loadError')
      }}
    />
    </>
  )
}
