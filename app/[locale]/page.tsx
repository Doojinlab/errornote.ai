import { setRequestLocale } from 'next-intl/server'
import { Noto_Sans_SC, JetBrains_Mono } from 'next/font/google'
import Nav from '@/components/landing/Nav'
import Hero from '@/components/landing/Hero'
import PartnerStrip from '@/components/landing/PartnerStrip'
import CoreValues from '@/components/landing/CoreValues'
import Demo3Pane from '@/components/landing/Demo3Pane'
import FlowSection from '@/components/landing/FlowSection'
import GamificationSection from '@/components/landing/GamificationSection'
import ProfessorSection from '@/components/landing/ProfessorSection'
import PartnersSection from '@/components/landing/PartnersSection'
import { CTASection, Footer } from '@/components/landing/CTAFooter'
import '@/components/landing/landing.css'

// Noto Sans SC carries the Simplified-Chinese glyphs (hanzi); JetBrains Mono is
// used for the monospace technical chips. Both are exposed as CSS variables that
// landing.css maps onto --hanzi / --mono. CJK fonts can't be fully preloaded, so
// preload is disabled to avoid Next's preload warning.
const notoSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  variable: '--font-noto-sc',
  display: 'swap',
  preload: false,
})

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
})

interface Props {
  params: Promise<{ locale: string }>
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className={`landing-root ${notoSC.variable} ${jetBrains.variable}`}>
      <Nav />
      <Hero />
      <PartnerStrip />
      <CoreValues />
      <Demo3Pane />
      <FlowSection />
      <GamificationSection />
      <ProfessorSection />
      <PartnersSection />
      <CTASection />
      <Footer />
    </div>
  )
}
