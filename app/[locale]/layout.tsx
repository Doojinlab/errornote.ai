import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'

// 거의 모든 라우트가 Supabase 세션(쿠키) 기반으로 개인화된다. @supabase/ssr 의
// async 쿠키 어댑터를 통해 cookies() 가 호출되면 Next 16 의 정적 분석이 이를 감지하지
// 못해 정적 생성 시도 → "Dynamic server usage" 로 빌드가 실패한다. 인증 게이트 앱이라
// 정적 생성 이점이 없으므로 locale 세그먼트 전체를 동적 렌더링으로 고정한다.
// (정적인 법적 고지 페이지 등은 해당 page 에서 `dynamic = 'force-static'` 로 개별 override 가능)
export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }
  setRequestLocale(locale)
  const messages = await getMessages()
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <PwaInstallPrompt />
    </NextIntlClientProvider>
  )
}
