'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Icon, Section } from './primitives'

const FULL_TEXT = '我两个小时睡了，觉得很累。今天上课的时候，老师说我们明天有考试，所以我必须好好复习。'

// Error spans are Chinese (literal); type drives the underline colour.
const ERRORS = [
  { span: '两个小时睡了', type: 'grammar' as const },
  { span: '上课的时候', type: 'fluency' as const },
]
const ACTIVE_SPAN = '两个小时睡了'
const ACTIVE_FIX = '睡了两个小时'
const COT_STEPS = 5

const TOTAL = 12000

export default function Demo3Pane() {
  const t = useTranslations('landing.demo')
  const [tick, setTick] = useState(0)
  const startRef = useRef(0)
  const reqRef = useRef(0)

  useEffect(() => {
    startRef.current = performance.now()
    const loop = (now: number) => {
      const elapsed = (now - startRef.current) % TOTAL
      setTick(elapsed)
      reqRef.current = requestAnimationFrame(loop)
    }
    reqRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(reqRef.current)
  }, [])

  const typedChars = Math.min(FULL_TEXT.length, Math.floor(tick / 70))
  const typedText = FULL_TEXT.slice(0, typedChars)
  const isTyping = tick < 2700 && typedChars < FULL_TEXT.length
  const showCursor = tick < 2900 && Math.floor(tick / 500) % 2 === 0
  const isAnalyzing = tick >= 2700 && tick < 3700
  const showHighlights = tick >= 3700
  const showRange = tick >= 4400
  const showFix = tick >= 5000
  const showExplain = tick >= 5600
  const showCot = tick >= 6000
  const showAIBubble = tick >= 7000
  const showMyReply = tick >= 9300
  const showFinalSolution = tick >= 10500

  const renderTextWithHighlights = (): ReactNode => {
    if (!showHighlights) {
      return (
        <span className="hanzi">
          {typedText}
          <Caret visible={showCursor && isTyping} />
        </span>
      )
    }
    let parts: ReactNode[] = [typedText]
    ERRORS.forEach((e, idx) => {
      const next: ReactNode[] = []
      parts.forEach((p) => {
        if (typeof p !== 'string') {
          next.push(p)
          return
        }
        const at = p.indexOf(e.span)
        if (at === -1) {
          next.push(p)
          return
        }
        next.push(p.slice(0, at))
        next.push(
          <span
            key={`hl-${idx}`}
            className="hanzi"
            style={{
              background: idx === 0 && showRange ? 'var(--red-soft)' : 'transparent',
              transition: 'background .35s ease',
              borderRadius: 3,
              padding: '0 2px',
              textDecoration: `underline wavy ${e.type === 'grammar' ? 'var(--red)' : 'var(--gold)'}`,
              textUnderlineOffset: 4,
              animation: 'ennFadeInUnderline .5s ease both',
            }}
          >
            {e.span}
          </span>
        )
        next.push(p.slice(at + e.span.length))
      })
      parts = next
    })
    return <span className="hanzi">{parts}</span>
  }

  return (
    <Section
      id="demo"
      eyebrow={t('eyebrow')}
      title={<DemoTitle text={t('title')} />}
      kicker={t('kicker')}
    >
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* window chrome */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--paper-2)',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FF5F57' }} />
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FEBC2E' }} />
            <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28C840' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginLeft: 12 }}>{t('windowTitle')}</div>
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 11.5,
              color: 'var(--ink-mute)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)' }} />
            {t('saved')}
          </div>
        </div>

        <div className="demo-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', minHeight: 540 }}>
          {/* LEFT — editor */}
          <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '14px 22px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon.Doc width="16" height="16" style={{ color: 'var(--ink-mute)' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('draftTitle')}</span>
              </div>
              <button
                style={{
                  background: 'var(--red)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: isAnalyzing ? '0 0 0 6px rgba(215,38,61,0.18)' : 'none',
                  transition: 'box-shadow .2s ease',
                }}
              >
                <Icon.Spark width="14" height="14" />
                {isAnalyzing ? t('analyzing') : t('analyzeBtn')}
              </button>
            </div>
            <div style={{ padding: '24px 22px', flex: 1, fontSize: 18, lineHeight: 2.0, position: 'relative' }}>
              {renderTextWithHighlights()}
              {isAnalyzing && (
                <div
                  style={{
                    position: 'absolute',
                    left: 22,
                    bottom: 22,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    color: 'var(--ink-mute)',
                    background: 'var(--paper-2)',
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: '1px solid var(--line)',
                  }}
                >
                  <span className="pulse-dot" /> {t('analyzingTip')}
                </div>
              )}
            </div>
            <div
              style={{
                padding: '12px 22px',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                gap: 14,
                fontSize: 12,
                color: 'var(--ink-mute)',
                background: 'var(--paper-2)',
              }}
            >
              <span>
                {t('countLabel')}: <strong style={{ color: 'var(--ink)' }}>{typedChars}</strong>
              </span>
              <span>
                {t('errorsLabel')}: <strong style={{ color: 'var(--red)' }}>{showHighlights ? ERRORS.length : 0}</strong>
              </span>
              <span>
                {t('hskAvgLabel')}: <strong style={{ color: 'var(--ink)' }}>{showHighlights ? t('hskAvgValue') : '—'}</strong>
              </span>
            </div>
          </div>

          {/* RIGHT — error card + chat */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* error card */}
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 320,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon.Card width="16" height="16" style={{ color: 'var(--ink-mute)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('errorCardTitle')}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {ERRORS.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: '1px solid var(--line)',
                        background: i === 0 ? 'var(--ink)' : 'transparent',
                        color: i === 0 ? 'var(--paper)' : 'var(--ink-mute)',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>

              {!showRange ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ink-faint)',
                    fontSize: 13,
                  }}
                >
                  {isAnalyzing ? <span className="pulse-dot-3" /> : t('cardEmpty')}
                </div>
              ) : (
                <>
                  <div className="staggerIn" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Tag color="red">{t('errSubtype')}</Tag>
                    <Tag>{t('hskTag')}</Tag>
                    <Tag>{t('fossilTag')}</Tag>
                  </div>
                  <RevealRow visible={showRange}>
                    <FieldLabel>{t('rangeLabel')}</FieldLabel>
                    <div className="hanzi" style={{ fontSize: 17, fontWeight: 600 }}>
                      {ACTIVE_SPAN}
                    </div>
                  </RevealRow>
                  <RevealRow visible={showFix}>
                    <FieldLabel>{t('fixLabel')}</FieldLabel>
                    <div className="hanzi" style={{ fontSize: 17, fontWeight: 600, color: 'var(--green)' }}>
                      {ACTIVE_FIX} <Icon.Check width="14" height="14" style={{ display: 'inline', verticalAlign: 'middle' }} />
                    </div>
                  </RevealRow>
                  <RevealRow visible={showExplain}>
                    <FieldLabel>{t('explainLabel')}</FieldLabel>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{t('explainText')}</div>
                  </RevealRow>
                  <RevealRow visible={showCot}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: 'var(--ink-mute)',
                        marginTop: 'auto',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {t('cotToggle', { count: COT_STEPS })}
                    </div>
                  </RevealRow>
                </>
              )}
            </div>

            {/* chat */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--paper-2)' }}>
              <div
                style={{
                  padding: '14px 22px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon.Bot width="16" height="16" style={{ color: 'var(--ink-mute)' }} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('tutorTitle')}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 'auto' }}>
                  {showAIBubble ? t('contextInjected', { subtype: t('errSubtype') }) : t('waiting')}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '14px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  minHeight: 140,
                }}
              >
                {showAIBubble && (
                  <RevealRow visible={showAIBubble}>
                    <ChatBubble who="ai">
                      <span className="hanzi">「{ACTIVE_SPAN}」</span>
                      {t('chatAiQuestion')}
                    </ChatBubble>
                  </RevealRow>
                )}
                {showMyReply && (
                  <RevealRow visible={showMyReply}>
                    <ChatBubble who="me">{t('chatMyReply')}</ChatBubble>
                  </RevealRow>
                )}
                {showFinalSolution && (
                  <RevealRow visible={showFinalSolution}>
                    <ChatBubble who="ai">
                      {t('chatSolPre')} (<span className="hanzi">两个小时</span>){t('chatSolMid')} →
                      <strong className="hanzi" style={{ color: 'var(--green)', marginLeft: 4 }}>
                        我睡了两个小时
                      </strong>
                      . {t('chatSolExamplesLabel')} <span className="hanzi">我等了你一个小时 / 他工作了三天</span>.
                    </ChatBubble>
                  </RevealRow>
                )}
              </div>
              <div
                style={{
                  padding: 14,
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  gap: 8,
                  background: 'var(--paper)',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    border: '1px solid var(--line)',
                    borderRadius: 999,
                    padding: '10px 16px',
                    fontSize: 13,
                    background: 'var(--paper)',
                    color: 'var(--ink-faint)',
                  }}
                >
                  {t('chatPlaceholder')}
                </div>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--ink)',
                    color: 'var(--paper)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ↑
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* progress bar */}
        <div style={{ height: 3, background: 'var(--paper-2)', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(tick / TOTAL) * 100}%`,
              background: 'var(--red)',
              transition: 'width 80ms linear',
            }}
          />
        </div>
      </div>

      <div
        style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-mute)', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <SeqDot active={tick < 2700}>{t('seq1')}</SeqDot>
        <SeqDot active={tick >= 2700 && tick < 3700}>{t('seq2')}</SeqDot>
        <SeqDot active={tick >= 3700 && tick < 4400}>{t('seq3')}</SeqDot>
        <SeqDot active={tick >= 4400 && tick < 7000}>{t('seq4')}</SeqDot>
        <SeqDot active={tick >= 7000}>{t('seq5')}</SeqDot>
      </div>
    </Section>
  )
}

function DemoTitle({ text }: { text: string }) {
  if (!text.includes('AI')) return <>{text}</>
  const [pre, post] = text.split('AI')
  return (
    <>
      {pre}
      <span style={{ color: 'var(--red)' }}>AI</span>
      {post}
    </>
  )
}

function Caret({ visible }: { visible: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 2,
        height: '1.1em',
        background: 'var(--red)',
        verticalAlign: '-0.15em',
        marginLeft: 1,
        opacity: visible ? 1 : 0,
      }}
    />
  )
}

function RevealRow({ visible, children }: { visible: boolean; children: ReactNode }) {
  return <div style={{ animation: visible ? 'ennRevealUp .45s ease both' : 'none', opacity: visible ? 1 : 0 }}>{children}</div>
}

function SeqDot({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: active ? 'var(--ink)' : 'var(--ink-faint)',
        fontWeight: active ? 600 : 400,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? 'var(--red)' : 'var(--line-strong)' }} />
      {children}
    </span>
  )
}

function Tag({ children, color }: { children: ReactNode; color?: 'red' | 'gold' }) {
  const map = {
    red: { bg: 'var(--red-soft)', fg: 'var(--red-deep)' },
    gold: { bg: '#FCF4DD', fg: '#7A5B14' },
    default: { bg: 'var(--paper-2)', fg: 'var(--ink-2)' },
  }
  const c = color ? map[color] : map.default
  return (
    <span
      style={{ padding: '3px 8px', background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700, borderRadius: 4, letterSpacing: '0.02em' }}
    >
      {children}
    </span>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}
    >
      {children}
    </div>
  )
}

function ChatBubble({ who, children }: { who: 'ai' | 'me'; children: ReactNode }) {
  const isMe = who === 'me'
  return (
    <div
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        background: isMe ? 'var(--ink)' : 'var(--paper)',
        color: isMe ? 'var(--paper)' : 'var(--ink)',
        border: isMe ? 'none' : '1px solid var(--line)',
        borderRadius: 14,
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}
