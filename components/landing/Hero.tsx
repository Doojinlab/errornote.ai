'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Icon, LinkButton } from './primitives'
import { assetUrl } from '@/lib/asset-url'

function HeadlineLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} style={{ display: 'block' }}>
          {line.includes('AI') ? (
            <>
              {line.split('AI')[0]}
              <span style={{ color: 'var(--red)' }}>AI</span>
              {line.split('AI')[1]}
            </>
          ) : (
            line
          )}
        </span>
      ))}
    </>
  )
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div className="display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {n}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 2 }}>{l}</div>
    </div>
  )
}

function FloatingErrorCard() {
  const t = useTranslations('landing.hero.floatingCard')
  return (
    <div
      className="hide-on-mobile"
      style={{
        position: 'absolute',
        left: -32,
        bottom: 32,
        width: 280,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 16,
        transform: 'rotate(-3deg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            padding: '2px 8px',
            background: 'var(--red-soft)',
            color: 'var(--red-deep)',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 4,
            letterSpacing: '0.04em',
          }}
        >
          {t('type')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>HSK 4{t('grade')}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 4 }}>{t('rangeLabel')}</div>
      <div className="hanzi" style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
        两个小时睡了
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 4 }}>{t('fixLabel')}</div>
      <div className="hanzi" style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>
        睡了两个小时 ✓
      </div>
      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px dashed var(--line)',
          fontSize: 11.5,
          color: 'var(--ink-mute)',
          lineHeight: 1.5,
        }}
      >
        {t('explain')}
      </div>
    </div>
  )
}

export default function Hero({ video = assetUrl('/video/hero.mp4') }: { video?: string }) {
  const t = useTranslations('landing.hero')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  const stats = t.raw('stats') as { n: string; l: string }[]

  return (
    <section
      id="top"
      style={{
        padding: 'clamp(40px, 6vw, 72px) 0 clamp(80px, 8vw, 120px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="hero-grid"
        style={{
          maxWidth: 'var(--max-w)',
          margin: '0 auto',
          padding: '0 var(--pad-x)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
          gap: 'clamp(32px, 5vw, 80px)',
          alignItems: 'center',
        }}
      >
        {/* LEFT — copy */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px 6px 8px',
              background: 'var(--paper-2)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--ink-2)',
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: 'var(--red)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              新
            </span>
            <span>{t('badge')}</span>
          </div>

          <h1
            className="display"
            style={{
              fontSize: 'clamp(44px, 6.2vw, 88px)',
              lineHeight: 0.98,
              letterSpacing: '-0.035em',
              fontWeight: 900,
              margin: 0,
            }}
          >
            <HeadlineLines text={t('headline')} />
          </h1>

          <p style={{ marginTop: 28, lineHeight: 1.55, color: 'var(--ink-mute)', maxWidth: 520, fontSize: 16 }}>
            {t('subhead')}
          </p>

          <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <LinkButton href="/signup" variant="primary" size="lg" icon={<Icon.Arrow width="16" height="16" />}>
              {t('ctaPrimary')}
            </LinkButton>
            <LinkButton href="/signup" variant="ghost" size="lg" icon={<Icon.Play width="14" height="14" />}>
              {t('ctaSecondary')}
            </LinkButton>
          </div>

          <div
            style={{
              marginTop: 48,
              display: 'flex',
              gap: 28,
              flexWrap: 'wrap',
              paddingTop: 24,
              borderTop: '1px solid var(--line)',
            }}
          >
            {stats.map((s, i) => (
              <Stat key={i} n={s.n} l={s.l} />
            ))}
          </div>
        </div>

        {/* RIGHT — video */}
        <div style={{ position: 'relative' }}>
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
            <video
              ref={videoRef}
              src={video}
              autoPlay
              loop
              muted={muted}
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(26,22,20,0.55) 100%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 18,
                left: 18,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(252,250,247,0.92)',
                backdropFilter: 'blur(8px)',
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--red)' }} />
              {t('liveBadge')}
            </div>
            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={t('muteToggle')}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 'none',
                background: 'rgba(252,250,247,0.92)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '24px', color: '#fff' }}>
              <div className="hanzi" style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
                我
                <span style={{ textDecoration: 'underline wavy var(--red)', textUnderlineOffset: 6 }}>
                  两个小时睡了
                </span>
                。
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                {t('caption')} <span className="hanzi">我睡了两个小时</span>
              </div>
            </div>
          </div>

          <FloatingErrorCard />
        </div>
      </div>
    </section>
  )
}
