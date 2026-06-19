// #49 — 개인정보처리방침 페이지 (/[locale]/privacy). 공개.
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { PRIVACY, getLegalLocale } from '@/lib/legal-content'
import LegalDocView from '@/components/LegalDocView'

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
