'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Icon, Section } from './primitives'

interface ValueItem {
  title: string
  body: string
  bullets: string[]
}

const META: { icon: ReactNode; hanzi: string }[] = [
  { icon: <Icon.Brain width="22" height="22" />, hanzi: '错' },
  { icon: <Icon.Flip width="22" height="22" />, hanzi: '翻' },
  { icon: <Icon.Trophy width="22" height="22" />, hanzi: '玩' },
  { icon: <Icon.Bot width="22" height="22" />, hanzi: '问' },
]

export default function CoreValues() {
  const t = useTranslations('landing.coreValues')
  const items = t.raw('items') as ValueItem[]

  return (
    <Section
      id="features"
      eyebrow={t('eyebrow')}
      title={<MultiLine text={t('title')} />}
      kicker={t('kicker')}
    >
      <div className="value-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {items.map((it, i) => (
          <article
            key={i}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              position: 'relative',
              overflow: 'hidden',
              minHeight: 360,
              transition: 'transform .25s ease, box-shadow .25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span
              className="hanzi"
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: -8,
                top: -16,
                fontSize: 140,
                fontWeight: 900,
                color: 'var(--paper-3)',
                lineHeight: 1,
                opacity: 0.6,
                pointerEvents: 'none',
              }}
            >
              {META[i].hanzi}
            </span>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--ink)',
                color: 'var(--paper)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {META[i].icon}
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 className="display" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                {it.title}
              </h3>
              <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-mute)', margin: '10px 0 0' }}>
                {it.body}
              </p>
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 'auto 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                position: 'relative',
                zIndex: 1,
                borderTop: '1px solid var(--line)',
                paddingTop: 14,
              }}
            >
              {it.bullets.map((b, j) => (
                <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                  <Icon.Check width="14" height="14" style={{ color: 'var(--red)', flexShrink: 0 }} />
                  {b}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  )
}

export function MultiLine({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}
