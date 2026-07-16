// 발음 재생 추상화 — playPronunciation(text).
// MVP: 브라우저 SpeechSynthesis(zh-CN). 이후 클라우드 TTS(예: ElevenLabs)로 교체 가능하도록
// 호출부는 이 함수만 알게 한다. 지문 길이 오디오(HSK 듣기)는 서버 TTS를 별도로 쓴다.

export interface SpeakOptions {
  /** 기본 zh-CN(중국어). */
  lang?: string
  /** 0.1~10, 기본 1.0. */
  rate?: number
}

/** 브라우저 음성 합성 지원 여부. */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** 텍스트를 소리내어 읽는다(중국어 기본). 지원 안 되거나 빈 문자열이면 무시. */
export function playPronunciation(text: string, opts: SpeakOptions = {}): void {
  if (!isSpeechSupported()) return
  const trimmed = text.trim()
  if (!trimmed) return
  const u = new SpeechSynthesisUtterance(trimmed)
  u.lang = opts.lang ?? 'zh-CN'
  u.rate = opts.rate ?? 1
  // 이전 발화를 끊고 새로 재생(연타 시 큐 적체 방지).
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

/** 재생 중지. */
export function stopPronunciation(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
