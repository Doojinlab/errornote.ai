// #49 — 개인정보처리방침 페이지 (/[locale]/privacy). 공개.
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { PRIVACY, getLegalLocale } from '@/lib/legal-content'
import LegalDocView from '@/components/LegalDocView'

// 공개·정적 콘텐츠(로케일별 약관)라 인증/쿠키가 필요 없다. 상위 locale 레이아웃의
// force-dynamic 을 이 페이지에서만 정적으로 되돌려 매 요청 서버 렌더 대신 캐시된
// HTML 을 즉시 제공한다(로케일은 상위 generateStaticParams 로 프리렌더).
export const dynamic = 'force-static'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  return { title: PRIVACY[getLegalLocale(locale)].title }
}

export default async function PrivacyPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  setRequestLocale(locale)
  const ll = getLegalLocale(locale)
  return <LegalDocView doc={PRIVACY[ll]} locale={ll} />
}
