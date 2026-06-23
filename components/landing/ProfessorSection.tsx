'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Icon, Section } from './primitives'
import { MultiLine } from './CoreValues'

const ICONS: ReactNode[] = [
  <Icon.Doc key="doc" width="22" height="22" />,
  <Icon.Live key="live" width="22" height="22" />,
  <Icon.Store key="store" width="22" height="22" />,
]
const ACCENT = [false, true, false]

interface Card {
  title: string
  body: string
  chip: string
}

function ProfCard({ icon, title, body, chip, accent }: { icon: ReactNode; title: string; body: string; chip: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? 'var(--red)' : 'rgba(252,250,247,0.04)',
        border: `1px solid ${accent ? 'var(--red)' : 'rgba(252,250,247,0.10)'}`,
        borderRadius: 'var(--r-lg)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 280,
        color: 'var(--paper)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: accent ? 'rgba(255,255,255,0.18)' : 'rgba(252,250,247,0.08)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <h3 className="display" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(252,250,247,0.75)', margin: 0, flex: 1 }}>{body}</p>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11.5,
          fontWeight: 500,
          color: 'rgba(252,250,247,0.55)',
          paddingTop: 14,
          borderTop: '1px solid rgba(252,250,247,0.10)',
        }}
      >
        {chip}
      </div>
    </div>
  )
}

export default function ProfessorSection() {
  const t = useTranslations('landing.professor')
  const cards = t.raw('cards') as Card[]

  return (
    <Section
      id="professor"
      eyebrow={t('eyebrow')}
      title={<MultiLine text={t('title')} />}
      kicker={t('kicker')}
      bg="var(--ink)"
      style={{ color: 'var(--paper)' }}
    >
      <div className="prof-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {cards.map((c, i) => (
          <ProfCard key={i} icon={ICONS[i]} title={c.title} body={c.body} chip={c.chip} accent={ACCENT[i]} />
        ))}
      </div>
    </Section>
  )
}
