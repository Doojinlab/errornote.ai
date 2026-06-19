// #49 — 이용약관 페이지 (/[locale]/terms). 공개.
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { TERMS, getLegalLocale } from '@/lib/legal-content'
import LegalDocView from '@/components/LegalDocView'

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  return { title: TERMS[getLegalLocale(locale)].title }
}

export default async function TermsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  setRequestLocale(locale)
  const ll = getLegalLocale(locale)
  return <LegalDocView doc={TERMS[ll]} locale={ll} />
}
