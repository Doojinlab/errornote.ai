// ElevenLabs TTS 클라이언트 — 중국어 텍스트(듣기 대본·热词 등)를 음성으로 합성한다.
// 서버 전용(app/api/tts). ELEVENLABS_API_KEY 없으면 비활성(호출처에서 503 폴백).
//
// 요청 구성(buildTtsRequest)은 순수 함수로 분리해 단위검증한다.

const TTS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'
// 기본 보이스(멀티링구얼 모델에서 중국어 지원). ELEVENLABS_VOICE_ID 로 재정의 가능.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel(여성) — 내레이션·단일 발화 기본
// 대화 멀티보이스용 화자별 기본 보이스(프리메이드, 멀티링구얼에서 중국어 발화).
const DEFAULT_VOICE_ID_FEMALE = '21m00Tcm4TlvDq8ikWAM' // Rachel(여성)
const DEFAULT_VOICE_ID_MALE = 'pNInz6obpgDQGcFmaJgB' // Adam(남성)
// 중국어 지원 모델. 기본 eleven_multilingual_v2(API 안정). ELEVENLABS_MODEL_ID 로 재정의 가능.
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
/** 대본 최대 길이(과금·남용 방지). */
export const TTS_MAX_CHARS = 800

/** 화자(male/female/narrator) → 보이스 id. 환경변수로 재정의 가능. */
export function resolveSpeakerVoiceId(speaker: 'male' | 'female' | 'narrator'): string {
  if (speaker === 'male') return process.env.ELEVENLABS_VOICE_ID_MALE ?? DEFAULT_VOICE_ID_MALE
  if (speaker === 'female') return process.env.ELEVENLABS_VOICE_ID_FEMALE ?? DEFAULT_VOICE_ID_FEMALE
  return process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID
}

export class ElevenLabsError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ElevenLabsError'
    this.status = status
  }
}

/** ELEVENLABS_API_KEY 설정 여부. */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY
}

export interface TtsOptions {
  voiceId?: string
  modelId?: string
  apiKey?: string
}

export interface TtsRequest {
  url: string
  headers: Record<string, string>
  body: string
}

/** ElevenLabs TTS HTTP 요청을 구성한다(순수). */
export function buildTtsRequest(text: string, opts: TtsOptions = {}): TtsRequest {
  const voiceId = opts.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID
  const modelId = opts.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID
  const apiKey = opts.apiKey ?? process.env.ELEVENLABS_API_KEY ?? ''
  return {
    url: `${TTS_ENDPOINT}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  }
}

export interface TtsResult {
  audio: ArrayBuffer
  contentType: string
}

/** 텍스트를 음성(mp3)으로 합성한다. 키 미설정/실패 시 ElevenLabsError. */
export async function synthesizeSpeech(text: string, opts: TtsOptions = {}): Promise<TtsResult> {
  const apiKey = opts.apiKey ?? process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new ElevenLabsError('ELEVENLABS_API_KEY 가 설정되지 않았습니다', 503)

  const trimmed = text.trim()
  if (!trimmed) throw new ElevenLabsError('합성할 텍스트가 비어 있습니다', 400)
  if (trimmed.length > TTS_MAX_CHARS) {
    throw new ElevenLabsError(`텍스트가 너무 깁니다(최대 ${TTS_MAX_CHARS}자)`, 400)
  }

  const req = buildTtsRequest(trimmed, { ...opts, apiKey })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 200)
    } catch {
      /* ignore */
    }
    throw new ElevenLabsError(
      `ElevenLabs TTS 실패(${res.status})${detail ? `: ${detail}` : ''}`,
      res.status,
    )
  }
  const audio = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') ?? 'audio/mpeg'
  return { audio, contentType }
}
