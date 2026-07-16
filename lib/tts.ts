// 발음 재생 유틸. TTS 합성은 ElevenLabs(서버, /api/tts)로 통일한다.
// 여기에는 순수 헬퍼(extractSpokenChinese)와 폴백용 브라우저 합성만 둔다.

/**
 * TTS로 읽을 텍스트에서 한글만 제거한다(한국어 뜻 오발음 방지).
 * 라틴 문자는 보존한다 — "city不city" 같은 영·중 혼용 신조어를 제대로 읽어야 하기 때문.
 * (멀티링구얼 모델이 영어+중국어 코드스위칭을 자연스럽게 발화.)
 * 예: "정서가치(情绪价值)" → "(情绪价值)", "city不city" → 그대로, "男：你好" → 그대로.
 */
export function extractSpokenChinese(text: string): string {
  return text
    .replace(/[가-힣ᄀ-ᇿ㄰-㆏]/g, "") // 한글
    .replace(/[ \t ]{2,}/g, " ")
    .trim()
}

export type DialogueSpeaker = "male" | "female" | "narrator"
export interface DialogueTurn {
  speaker: DialogueSpeaker
  /** 화자 표기(男：/女：)를 뺀 발화 본문. */
  text: string
}

/**
 * 대화 대본을 화자 발화 단위로 나눈다(멀티보이스 합성용).
 * "男：…" → male, "女：…" → female, 화자 표기 없는 앞부분/독백 → narrator.
 * 화자 표기 자체(男/女·콜론)는 발화 텍스트에서 제거한다(TTS 가 "남/여"를 읽지 않도록).
 */
export function parseDialogueTurns(script: string): DialogueTurn[] {
  const normalized = script.replace(/\r\n/g, "\n")
  const re = /([男女])\s*[：:]/g
  const turns: DialogueTurn[] = []
  let lastIndex = 0
  let speaker: DialogueSpeaker = "narrator"
  let m: RegExpExecArray | null
  while ((m = re.exec(normalized)) !== null) {
    const before = normalized.slice(lastIndex, m.index).trim()
    if (before) turns.push({ speaker, text: before })
    speaker = m[1] === "男" ? "male" : "female"
    lastIndex = re.lastIndex
  }
  const tail = normalized.slice(lastIndex).trim()
  if (tail) turns.push({ speaker, text: tail })
  return turns.filter((t) => t.text)
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
