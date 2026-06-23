'use client'

import { useTranslations } from 'next-intl'
import { Section } from './primitives'
import { MultiLine } from './CoreValues'

interface Univ {
  ko: string
  en: string
  dept: string
}

export default function PartnersSection({ video = '/video/feature.mp4' }: { video?: string }) {
  const t = useTranslations('landing.partners')
  const universities = t.raw('universities') as Univ[]

  return (
    <Section id="partners" eyebrow={t('eyebrow')} title={<MultiLine text={t('title')} />} kicker={t('kicker')}>
      <div className="partners-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        {/* Universities list */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {universities.map((u, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '20px 0',
                  borderBottom: i === universities.length - 1 ? 'none' : '1px solid var(--line)',
                }}
              >
                <div
                  className="display"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--ink-mute)',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                    {u.ko}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
                    {u.en} · {u.dept}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    background: 'var(--red-soft)',
                    color: 'var(--red-deep)',
                    borderRadius: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('badge')}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 24,
              padding: 18,
              background: 'var(--paper-2)',
              border: '1px dashed var(--line-strong)',
              borderRadius: 'var(--r-md)',
              fontSize: 13.5,
              color: 'var(--ink-2)',
              lineHeight: 1.55,
            }}
          >
            <strong>{t('ctaStrong')}</strong> {t('ctaRest')}
            <a href="#contact" style={{ color: 'var(--red)', fontWeight: 600, marginLeft: 6 }}>
              {t('ctaLink')}
            </a>
          </div>
        </div>

        {/* Feature video */}
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--r-xl)',
            overflow: 'hidden',
            background: 'var(--ink)',
            aspectRatio: '4/5',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--line)',
          }}
        >
          <video src={video} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(26,22,20,0.7) 100%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'absolute', left: 24, bottom: 24, right: 24, color: '#fff' }}>
            <div
              className="hanzi"
              style={{ fontSize: 'clamp(28px, 3.6vw, 44px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05 }}
            >
              一起写汉语
            </div>
            <div style={{ fontSize: 14, opacity: 0.85, marginTop: 8 }}>{t('videoUniversities')}</div>
          </div>
        </div>
      </div>
    </Section>
  )
}
