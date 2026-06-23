'use client'

import { useTranslations } from 'next-intl'
import { Section } from './primitives'
import { MultiLine } from './CoreValues'

const LEVEL_META = [
  { name: '初学者', icon: '🐣' },
  { name: '进步中', icon: '🐼' },
  { name: '优秀生', icon: '🐉' },
  { name: '汉语达人', icon: '🏆' },
]
const BADGE_ICONS = ['⭐', '🔥', '📚', '🥋', '🔍', '🎯']

export default function GamificationSection() {
  const t = useTranslations('landing.gamification')
  const levels = t.raw('levels') as { sub: string; xp: string }[]
  const badges = t.raw('badges') as { name: string; cond: string }[]

  return (
    <Section id="gamification" eyebrow={t('eyebrow')} title={<MultiLine text={t('title')} />} kicker={t('kicker')}>
      <div className="gam-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28 }}>
        {/* Levels */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 28 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-mute)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 18,
            }}
          >
            {t('levelsTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {levels.map((l, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 60px 1fr auto',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 16px',
                  background: i === 1 ? 'var(--red-soft)' : 'var(--paper-2)',
                  border: i === 1 ? '1px solid var(--red-line)' : '1px solid var(--line)',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 28 }}>{LEVEL_META[i].icon}</div>
                <div className="display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-mute)' }}>
                  Lv.{i + 1}
                </div>
                <div>
                  <div className="hanzi" style={{ fontSize: 18, fontWeight: 700 }}>
                    {LEVEL_META[i].name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{l.sub}</div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: i === 1 ? 'var(--red-deep)' : 'var(--ink-mute)',
                  }}
                >
                  {l.xp}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              padding: 14,
              background: 'var(--paper-2)',
              borderRadius: 10,
              border: '1px dashed var(--line-strong)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-mute)' }}>{t('progressLabel')}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '38%', height: '100%', background: 'var(--red)' }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700 }}>720 / 2000 XP</span>
          </div>
        </div>

        {/* Badges */}
        <div
          style={{
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderRadius: 'var(--r-lg)',
            padding: 28,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(252,250,247,0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 18,
            }}
          >
            {t('badgesTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {badges.map((b, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(252,250,247,0.06)',
                  border: '1px solid rgba(252,250,247,0.10)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1 }}>{BADGE_ICONS[i]}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{b.name}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(252,250,247,0.55)', lineHeight: 1.4 }}>{b.cond}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 11.5,
              color: 'rgba(252,250,247,0.55)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--red)' }} />
            {t('soundNote')}
          </div>
        </div>
      </div>
    </Section>
  )
}
