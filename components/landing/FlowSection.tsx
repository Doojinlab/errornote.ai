'use client'

import { useTranslations } from 'next-intl'
import { Icon, Section } from './primitives'
import { MultiLine } from './CoreValues'

const HAN = ['写', '析', '卡', '累', '报']

interface Step {
  title: string
  body: string
  tag: string
}

export default function FlowSection() {
  const t = useTranslations('landing.flow')
  const steps = t.raw('steps') as Step[]

  return (
    <Section
      id="flow"
      eyebrow={t('eyebrow')}
      title={<MultiLine text={t('title')} />}
      kicker={t('kicker')}
      bg="var(--paper-2)"
    >
      <div className="flow-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)',
              padding: 22,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 240,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                className="display"
                style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.08em' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="hanzi" style={{ fontSize: 36, fontWeight: 900, color: 'var(--paper-3)', lineHeight: 1 }}>
                {HAN[i]}
              </span>
            </div>
            <h3 className="display" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              {s.title}
            </h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-mute)', margin: 0, flex: 1 }}>{s.body}</p>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--ink-mute)',
                padding: '4px 8px',
                background: 'var(--paper-2)',
                border: '1px solid var(--line)',
                borderRadius: 4,
                alignSelf: 'flex-start',
                fontFamily: 'var(--mono)',
              }}
            >
              {s.tag}
            </div>
            {i < steps.length - 1 && (
              <div
                className="flow-arrow"
                style={{
                  position: 'absolute',
                  right: -10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--line-strong)',
                  zIndex: 2,
                }}
              >
                <Icon.Arrow width="20" height="20" />
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}
