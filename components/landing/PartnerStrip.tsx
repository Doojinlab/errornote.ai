'use client'

import { useTranslations } from 'next-intl'

export default function PartnerStrip() {
  const t = useTranslations('landing.partnerStrip')
  const partners = t.raw('partners') as { ko: string; sub: string }[]

  return (
    <div
      style={{
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        background: 'var(--paper-2)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--max-w)',
          margin: '0 auto',
          padding: '28px var(--pad-x)',
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', fontWeight: 500, flexShrink: 0 }}>
          {t('label')}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'clamp(20px, 4vw, 56px)',
            flexWrap: 'wrap',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          {partners.map((p, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                {p.ko}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
