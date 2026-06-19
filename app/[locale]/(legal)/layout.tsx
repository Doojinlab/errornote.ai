// #49 — 법적 문서 페이지(개인정보/약관) 공용 레이아웃. 인증 불필요(공개).
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const tMeta = await getTranslations('meta')
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <Link href="/" className="text-sm font-bold text-indigo-600">
          {tMeta('appName')}
        </Link>
        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
