'use client'

import type { CSSProperties, ReactNode, SVGProps, ButtonHTMLAttributes } from 'react'
import { Link } from '@/i18n/routing'

/* ---------- ICONS (minimal stroke icons) ---------- */
type IconProps = SVGProps<SVGSVGElement>

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const Icon = {
  Brain: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M9 4a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3 3 3 0 0 0 1 2.2A3 3 0 0 0 4 14a3 3 0 0 0 2 2.8V18a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V5a3 3 0 0 0-3-1Z" />
      <path d="M15 4a3 3 0 0 1 3 3v0a3 3 0 0 1 3 3 3 3 0 0 1-1 2.2A3 3 0 0 1 20 14a3 3 0 0 1-2 2.8V18a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V5a3 3 0 0 1 3-1Z" />
    </svg>
  ),
  Flip: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 12h18M12 5v14" />
    </svg>
  ),
  Trophy: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M16 6h3v2a3 3 0 0 1-3 3M8 6H5v2a3 3 0 0 0 3 3" />
      <path d="M10 12v3M14 12v3M8 18h8M9 21h6" />
    </svg>
  ),
  Chat: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  ),
  Arrow: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Check: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2} {...p}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  Spark: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  ),
  Play: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M7 5v14l12-7L7 5Z" />
    </svg>
  ),
  Doc: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 16h5" />
    </svg>
  ),
  Card: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  ),
  Bot: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M9 12h.01M15 12h.01M9 16h6M12 4v3" />
    </svg>
  ),
  Live: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  ),
  Store: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...stroke} {...p}>
      <path d="M4 8l1-4h14l1 4M4 8h16v12H4zM4 8a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 4 0" />
    </svg>
  ),
}

/* ---------- BUTTON ---------- */
type ButtonVariant = 'primary' | 'red' | 'ghost' | 'plain'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

const BTN_SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '8px 14px', fontSize: 13, gap: 6 },
  md: { padding: '12px 20px', fontSize: 14.5, gap: 8 },
  lg: { padding: '16px 28px', fontSize: 16, gap: 10 },
}
const BTN_VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)' },
  red: { background: 'var(--red)', color: '#fff', border: '1px solid var(--red)' },
  ghost: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line-strong)' },
  plain: { background: 'transparent', color: 'var(--ink)', border: '1px solid transparent' },
}

export function Button({ children, variant = 'primary', size = 'md', icon, style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        borderRadius: 999,
        transition: 'all .18s ease',
        ...BTN_SIZES[size],
        ...BTN_VARIANTS[variant],
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {children}
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
    </button>
  )
}

/* ---------- LINK BUTTON (navigational CTA, locale-aware) ---------- */
interface LinkButtonProps {
  href: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  style?: CSSProperties
}

export function LinkButton({ href, children, variant = 'primary', size = 'md', icon, style }: LinkButtonProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        borderRadius: 999,
        transition: 'all .18s ease',
        ...BTN_SIZES[size],
        ...BTN_VARIANTS[variant],
        ...style,
      }}
    >
      {children}
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
    </Link>
  )
}

/* ---------- LOGO ---------- */
export function Logo() {
  return (
    <span
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'var(--ink)',
        color: 'var(--paper)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--display)',
        fontWeight: 900,
        fontSize: 15,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <span style={{ transform: 'translateY(-0.5px)' }}>误</span>
      <span
        style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 8,
          height: 8,
          borderRadius: 999,
          background: 'var(--red)',
          border: '1.5px solid var(--paper)',
        }}
      />
    </span>
  )
}

/* ---------- EYEBROW ---------- */
export function Eyebrow({ children, color = 'var(--red)' }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
      }}
    >
      <span style={{ width: 18, height: 1, background: 'currentColor', opacity: 0.6 }} />
      {children}
    </div>
  )
}

/* ---------- SECTION ---------- */
interface SectionProps {
  id?: string
  eyebrow?: ReactNode
  title?: ReactNode
  kicker?: ReactNode
  children?: ReactNode
  bg?: string
  dense?: boolean
  style?: CSSProperties
}

export function Section({ id, eyebrow, title, kicker, children, bg, dense, style }: SectionProps) {
  return (
    <section
      id={id}
      style={{
        background: bg || 'transparent',
        padding: dense ? '80px 0' : '120px 0',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: '0 var(--pad-x)' }}>
        {(eyebrow || title) && (
          <header style={{ marginBottom: 56, maxWidth: 760 }}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {title && (
              <h2
                className="display"
                style={{
                  fontSize: 'clamp(34px, 4.4vw, 60px)',
                  lineHeight: 1.05,
                  fontWeight: 800,
                  margin: '16px 0 0',
                  letterSpacing: '-0.025em',
                }}
              >
                {title}
              </h2>
            )}
            {kicker && (
              <p
                style={{
                  marginTop: 18,
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: 'var(--ink-mute)',
                  maxWidth: 620,
                }}
              >
                {kicker}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  )
}
