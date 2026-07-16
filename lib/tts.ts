// 발음 재생 유틸. TTS 합성은 ElevenLabs(서버, /api/tts)로 통일한다.
// 여기에는 순수 헬퍼(extractSpokenChinese)와 폴백용 브라우저 합성만 둔다.

/**
 * TTS로 읽을 중국어만 남긴다(한글·라틴 문자 제거 → 한국어/영문 오발음 방지).
 * 예: "정서가치(情绪价值)" → "(情绪价值)", "男：你好" → 그대로. CJK·숫자·문장부호는 보존.
 */
export function extractSpokenChinese(text: string): string {
  return text
    .replace(/[가-힣ᄀ-ᇿ㄰-㆏]/g, "") // 한글
    .replace(/[A-Za-z]/g, "") // 라틴 문자
    .replace(/[ \t ]{2,}/g, " ")
    .trim()
}

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
