'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square, Sparkles, History, RotateCcw, Volume2 } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { LipButton } from '@/components/student-ui'
import type {
  PronunciationLanguage,
  PronunciationAnalyzeResponse,
  PronunciationError,
} from '@/types/pronunciation'

const SAMPLE_TEXTS: Record<PronunciationLanguage, { title: string; text: string }[]> = {
  'en-US': [
    {
      title: 'Daily Greeting',
      text: 'Good morning. How are you doing today? I hope you have a wonderful day.',
    },
    {
      title: 'Weather Talk',
      text: 'The weather is beautiful today. The sun is shining brightly and there are no clouds in the sky.',
    },
    {
      title: 'Self Introduction',
      text: 'My name is Alex. I am a student at the university. I enjoy studying English and meeting new people.',
    },
  ],
  'ko-KR': [
    {
      title: '일상 인사',
      text: '안녕하세요. 오늘 날씨가 정말 좋네요. 기분 좋은 하루 보내세요.',
    },
    {
      title: '자기소개',
      text: '저는 대학교에 다니고 있는 학생입니다. 한국어를 열심히 공부하고 있습니다.',
    },
    {
      title: '감사 표현',
      text: '도와주셔서 정말 감사합니다. 덕분에 많은 것을 배웠습니다.',
    },
  ],
}

// 오류 칩은 팔레트 절제 원칙에 따라 terra(오류 마킹 전용)로 통일. 스펙 §2.
const ERROR_CHIP = 'bg-terra-soft text-terra-dark'

// 점수 밴드별 토큰 매핑 — 인라인 hex 금지, 정적 클래스 문자열만 사용.
type ScoreBand = 'jade' | 'gold' | 'terra'
const SCORE_STYLES: Record<ScoreBand, { text: string; soft: string; bar: string; border: string }> = {
  jade: { text: 'text-jade', soft: 'bg-jade-soft', bar: 'bg-jade', border: 'border-jade-soft' },
  gold: { text: 'text-gold', soft: 'bg-gold-soft', bar: 'bg-gold', border: 'border-gold-soft' },
  terra: { text: 'text-terra', soft: 'bg-terra-soft', bar: 'bg-terra', border: 'border-terra-soft' },
}
const scoreBand = (s: number): ScoreBand => (s >= 90 ? 'jade' : s >= 70 ? 'gold' : 'terra')
const scoreEmoji = (s: number) => (s >= 90 ? '🌟' : s >= 70 ? '👍' : '💪')

interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onerror: ((e: ISpeechRecognitionErrorEvent) => void) | null
}

interface ISpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

export default function PronunciationPage() {
  const t = useTranslations('pages.student.pronunciation')

  const [language, setLanguage] = useState<PronunciationLanguage>('en-US')
  const [targetText, setTargetText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<PronunciationAnalyzeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedSample, setSelectedSample] = useState<number | null>(null)
  // 음성 인식 지원 여부는 마운트 후 판별(SSR 안전). null = 판별 전.
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR 하이드레이션 불일치 방지를 위해 마운트 후 1회 브라우저 Web Speech 지원 여부를 반영하는 의도적 effect
    setSpeechSupported(
      typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    )
  }, [])

  const errorTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      word_substitution: t('errorWordSubstitution'),
      word_omission: t('errorWordOmission'),
      word_insertion: t('errorWordInsertion'),
      stress_error: t('errorStressError'),
      intonation_error: t('errorIntonationError'),
      vowel_error: t('errorVowelError'),
      consonant_error: t('errorConsonantError'),
    }
    return map[type] ?? type
  }

  const startRecording = useCallback(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError(t('noSupportError'))
      return
    }
    if (!targetText.trim()) {
      setError(t('noTextError'))
      return
    }

    const recognition = new SR()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsRecording(true)
      setTranscript('')
      setResult(null)
      setError(null)
    }

    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      const current = Array.from(e.results)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join('')
      setTranscript(current)
    }

    recognition.onerror = (e: ISpeechRecognitionErrorEvent) => {
      setError(`Recording error: ${e.error}`)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [language, targetText, t])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const analyze = useCallback(async () => {
    if (!transcript.trim() || !targetText.trim()) return
    setIsAnalyzing(true)
    setError(null)

    try {
      const res = await fetch('/api/pronunciation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetText, recognizedText: transcript, language }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('analysisFailedError'))
        return
      }
      setResult(data as PronunciationAnalyzeResponse)
    } catch {
      setError(t('networkError'))
    } finally {
      setIsAnalyzing(false)
    }
  }, [transcript, targetText, language, t])

  const selectSample = (idx: number) => {
    setTargetText(SAMPLE_TEXTS[language][idx].text)
    setSelectedSample(idx)
    setTranscript('')
    setResult(null)
  }

  const switchLanguage = (lang: PronunciationLanguage) => {
    setLanguage(lang)
    setTargetText('')
    setSelectedSample(null)
    setTranscript('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-bodytx">{t('subtitle')}</p>
        </div>
        <Link
          href="/pronunciation/history"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-bodytx"
        >
          <History size={14} aria-hidden />
          {t('historyLink')}
        </Link>
      </header>

      {speechSupported === false ? (
        <div className="rounded-xl2 border border-hairline bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-terra-soft text-terra">
            <Mic size={22} aria-hidden />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">{t('unsupportedTitle')}</p>
          <p className="mt-1 text-sm text-bodytx">{t('unsupportedBody')}</p>
        </div>
      ) : (
        <>
          {/* 언어 선택 */}
          <div className="flex gap-2">
            {(['en-US', 'ko-KR'] as PronunciationLanguage[]).map(lang => (
              <button
                key={lang}
                onClick={() => switchLanguage(lang)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  language === lang
                    ? 'bg-blue text-white'
                    : 'border border-hairline bg-white text-bodytx'
                }`}
              >
                {lang === 'en-US' ? `🇺🇸 ${t('langEnUS')}` : `🇰🇷 ${t('langKoKR')}`}
              </button>
            ))}
          </div>

          {/* 샘플 텍스트 */}
          <section>
            <h2 className="mb-2 text-sm font-bold text-ink">{t('sampleTextsTitle')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_TEXTS[language].map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => selectSample(idx)}
                  className={`rounded-xl2 border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedSample === idx
                      ? 'border-blue bg-blue-soft text-blue-dark'
                      : 'border-hairline bg-white text-bodytx'
                  }`}
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </section>

          {/* 읽을 텍스트 */}
          <section>
            <label className="mb-1.5 block text-sm font-bold text-ink">{t('textInputLabel')}</label>
            <textarea
              value={targetText}
              onChange={e => {
                setTargetText(e.target.value)
                setSelectedSample(null)
              }}
              placeholder={t('textInputPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-xl2 border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue-soft"
            />
          </section>

          {/* 녹음 / 분석 액션 */}
          <section className="space-y-3">
            {!isRecording ? (
              <LipButton
                variant="blue"
                full
                onClick={startRecording}
                className={!targetText.trim() ? 'pointer-events-none opacity-40' : ''}
              >
                <Mic size={18} aria-hidden />
                {t('startRecording')}
              </LipButton>
            ) : (
              <button
                onClick={stopRecording}
                className="lip inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border-b-4 border-terra-dark bg-terra px-5 py-3 font-extrabold text-white"
              >
                <Square size={16} aria-hidden />
                {t('stop')}
              </button>
            )}

            {transcript && !isRecording && (
              <LipButton variant="jade" full onClick={analyze} className={isAnalyzing ? 'opacity-60' : ''}>
                <Sparkles size={18} aria-hidden />
                {isAnalyzing ? t('analyzing') : t('analyze')}
              </LipButton>
            )}

            {!targetText.trim() && !isRecording && !transcript && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                <Volume2 size={14} aria-hidden />
                {t('recordHint')}
              </p>
            )}
          </section>

          {/* 인식 결과(내 발음) */}
          {(isRecording || transcript) && (
            <div
              className={`rounded-xl2 border px-4 py-3 ${
                isRecording ? 'border-terra-soft bg-terra-soft' : 'border-hairline bg-white'
              }`}
            >
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted">
                {isRecording ? (
                  <>
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-terra" />
                    {t('recordingLabel')}
                  </>
                ) : (
                  t('speechLabel')
                )}
              </p>
              <p className="min-h-[1.5rem] text-sm text-ink">
                {transcript || <span className="italic text-muted">{t('listeningPlaceholder')}</span>}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl2 border border-terra-soft bg-terra-soft px-4 py-3 text-sm font-medium text-terra-dark">
              {error}
            </div>
          )}

          {/* 분석 결과 */}
          {result && (
            <div className="space-y-4">
              <div className="h-px bg-hairline" />
              <h2 className="text-lg font-extrabold text-ink">{t('resultsTitle')}</h2>

              <ScoreCard score={result.accuracy_score} label={t('accuracyLabel')} />

              {result.analysis.errors.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-bold text-ink">
                    {t('issuesFound', { count: result.analysis.errors.length })}
                  </h3>
                  <div className="space-y-2">
                    {result.analysis.errors.map((err: PronunciationError, i: number) => (
                      <div key={i} className="rounded-xl2 border border-hairline bg-white px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${ERROR_CHIP}`}>
                            {errorTypeLabel(err.type)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink">{err.word}</p>
                            {err.recognized && (
                              <p className="text-xs text-muted">{t('saidLabel', { text: err.recognized })}</p>
                            )}
                            <p className="mt-1 text-xs text-bodytx">{err.explanation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FeedbackCard title={t('toneFeedbackTitle')} body={result.analysis.tone_feedback} tone="blue" />
                <FeedbackCard title={t('stressFeedbackTitle')} body={result.analysis.stress_feedback} tone="jade" />
              </div>

              <div className="rounded-xl2 border border-hairline bg-white px-4 py-3">
                <p className="mb-1 text-xs font-bold text-muted">{t('overallFeedbackTitle')}</p>
                <p className="text-sm text-bodytx">{result.analysis.overall_feedback}</p>
              </div>

              {result.analysis.tips.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-bold text-ink">{t('tipsTitle')}</h3>
                  <ul className="space-y-1.5">
                    {result.analysis.tips.map((tip: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-bodytx">
                        <span className="mt-0.5 shrink-0 font-bold text-jade">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <LipButton
                variant="white"
                full
                onClick={() => {
                  setTranscript('')
                  setResult(null)
                }}
              >
                <RotateCcw size={16} aria-hidden />
                {t('tryAgain')}
              </LipButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// 정확도 점수 카드 — 밴드별 jade/gold/terra 토큰.
function ScoreCard({ score, label }: { score: number; label: string }) {
  const s = SCORE_STYLES[scoreBand(score)]
  return (
    <div className={`rounded-xl2 border ${s.border} ${s.soft} px-6 py-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-bodytx">{label}</p>
          <p className={`mt-1 text-4xl font-extrabold ${s.text}`}>{score}%</p>
        </div>
        <span className="text-5xl" aria-hidden>
          {scoreEmoji(score)}
        </span>
      </div>
    </div>
  )
}

// 피드백 카드 — blue(음조)·jade(강세) 두 톤만 사용.
function FeedbackCard({ title, body, tone }: { title: string; body: string; tone: 'blue' | 'jade' }) {
  const styles =
    tone === 'blue'
      ? { border: 'border-blue-soft', soft: 'bg-blue-soft', title: 'text-blue-dark' }
      : { border: 'border-jade-soft', soft: 'bg-jade-soft', title: 'text-jade-dark' }
  return (
    <div className={`rounded-xl2 border ${styles.border} ${styles.soft} px-4 py-3`}>
      <p className={`mb-1 text-xs font-bold ${styles.title}`}>{title}</p>
      <p className="text-sm text-bodytx">{body}</p>
    </div>
  )
}
