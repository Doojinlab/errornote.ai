'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Button, Icon, LinkButton, Logo } from './primitives'

const NAV_LINKS = [
  { href: '#features', key: 'features' },
  { href: '#demo', key: 'demo' },
  { href: '#flow', key: 'flow' },
  { href: '#gamification', key: 'gamification' },
  { href: '#professor', key: 'professor' },
  { href: '#partners', key: 'partners' },
] as const

export default function Nav() {
  const t = useTranslations('landing.nav')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const linkStyle = {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ink-2)',
    padding: '8px 12px',
    borderRadius: 8,
  } as const

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: scrolled ? 'rgba(252,250,247,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(140%) blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'saturate(140%) blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
        transition: 'all .25s ease',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--max-w)',
          margin: '0 auto',
          padding: '14px var(--pad-x)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo />
          <span className="display" style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' }}>
            AI오답노트
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--red)',
              padding: '3px 7px',
              border: '1px solid var(--red-line)',
              background: 'var(--red-soft)',
              borderRadius: 4,
              marginLeft: 2,
            }}
          >
            BETA
          </span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.key} href={l.href} style={linkStyle}>
              {t(l.key)}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageSwitcher />
          <Link href="/login">
            <Button variant="plain" size="sm">
              {t('login')}
            </Button>
          </Link>
          <LinkButton href="/signup" variant="primary" size="sm" icon={<Icon.Arrow width="14" height="14" />}>
            {t('start')}
          </LinkButton>
        </div>
      </div>
    </nav>
  )
}
