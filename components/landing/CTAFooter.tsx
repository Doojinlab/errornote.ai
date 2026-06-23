'use client'

import { useTranslations } from 'next-intl'
import { Icon, LinkButton, Logo } from './primitives'
import { MultiLine } from './CoreValues'

export function CTASection() {
  const t = useTranslations('landing.cta')
  return (
    <section
      id="contact"
      style={{ padding: '120px 0', background: 'var(--paper-2)', borderTop: '1px solid var(--line)' }}
    >
      <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: '0 var(--pad-x)', textAlign: 'center' }}>
        <div
          className="hanzi"
          style={{
            fontSize: 'clamp(80px, 12vw, 180px)',
            fontWeight: 900,
            lineHeight: 1,
            color: 'var(--paper-3)',
            letterSpacing: '-0.04em',
            marginBottom: -40,
            userSelect: 'none',
          }}
        >
          错也没关系
        </div>
        <h2
          className="display"
          style={{
            fontSize: 'clamp(40px, 5.5vw, 76px)',
            fontWeight: 900,
            letterSpacing: '-0.035em',
            lineHeight: 1.0,
            margin: '0 0 22px',
          }}
        >
          {t('titlePre')}
          <span style={{ color: 'var(--red)' }}>{t('titleHighlight')}</span>
          {t('titlePost')}
        </h2>
        <p
          style={{
            fontSize: 'clamp(15px, 1.4vw, 18px)',
            color: 'var(--ink-mute)',
            maxWidth: 540,
            margin: '0 auto 36px',
            lineHeight: 1.55,
          }}
        >
          {t('sub')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <LinkButton href="/signup" variant="red" size="lg" icon={<Icon.Arrow width="16" height="16" />}>
            {t('ctaStudent')}
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="lg">
            {t('ctaProfessor')}
          </LinkButton>
        </div>
      </div>
    </section>
  )
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--paper)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 13.5 }}>
            <a href="#" style={{ color: 'inherit' }}>
              {it}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  const t = useTranslations('landing.footer')
  const cols = t.raw('columns') as { title: string; items: string[] }[]

  return (
    <footer style={{ background: 'var(--ink)', color: 'rgba(252,250,247,0.7)', padding: '60px 0 36px' }}>
      <div
        className="footer-grid"
        style={{
          maxWidth: 'var(--max-w)',
          margin: '0 auto',
          padding: '0 var(--pad-x)',
          display: 'grid',
          gridTemplateColumns: '1.5fr repeat(3, 1fr)',
          gap: 40,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Logo />
            <span
              className="display"
              style={{ fontWeight: 800, fontSize: 19, color: 'var(--paper)', letterSpacing: '-0.02em' }}
            >
              AI오답노트
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, maxWidth: 320 }}>{t('desc')}</p>
          <p style={{ fontSize: 11.5, marginTop: 18, color: 'rgba(252,250,247,0.4)' }}>
            <MultiLine text={t('affiliation')} />
          </p>
        </div>
        {cols.map((c, i) => (
          <FooterCol key={i} title={c.title} items={c.items} />
        ))}
      </div>
    </footer>
  )
}
