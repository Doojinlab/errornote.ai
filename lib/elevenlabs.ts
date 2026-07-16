// ElevenLabs TTS 클라이언트 — 중국어 텍스트(듣기 대본·热词 등)를 음성으로 합성한다.
// 서버 전용(app/api/tts). ELEVENLABS_API_KEY 없으면 비활성(호출처에서 503 폴백).
//
// 요청 구성(buildTtsRequest)은 순수 함수로 분리해 단위검증한다.

const TTS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'
// 기본 보이스(멀티링구얼 모델에서 중국어 지원). ELEVENLABS_VOICE_ID 로 재정의 가능.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel(여성) — 내레이션·단일 발화 기본

// 대화 멀티보이스 — 성별별 프리메이드 보이스 풀(멀티링구얼에서 중국어 발화).
// 스크립트마다 풀에서 다른 조합을 골라 "다양한 성우"를 자동 배정한다.
// 더 나은(네이티브) 중국어 보이스가 있으면 아래 env 로 교체(쉼표로 여러 개 = 풀).
const DEFAULT_MALE_VOICE_POOL = [
  'pNInz6obpgDQGcFmaJgB', // Adam
  'ErXwobaYiN019PkySvjV', // Antoni
  'TxGEqnHWrfWFTfGW9XjX', // Josh
]
const DEFAULT_FEMALE_VOICE_POOL = [
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'EXAVITQu4vr4xnSDxMaL', // Bella
  'MF3mGyEYCl7XYWbV9V6O', // Elli
]
// 중국어 지원 모델. 기본 eleven_multilingual_v2(API 안정). ELEVENLABS_MODEL_ID 로 재정의 가능.
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
/** 대본 최대 길이(과금·남용 방지). */
export const TTS_MAX_CHARS = 800

function envVoiceList(name: string): string[] | null {
  const v = process.env[name]
  if (!v) return null
  const arr = v.split(',').map((s) => s.trim()).filter(Boolean)
  return arr.length > 0 ? arr : null
}

export interface VoicePools {
  male: string[]
  female: string[]
  narrator: string
}

/** 성별 보이스 풀 + 내레이터 보이스. 환경변수(쉼표 목록)로 재정의 가능. */
export function getVoicePools(): VoicePools {
  return {
    male: envVoiceList('ELEVENLABS_VOICE_ID_MALE') ?? DEFAULT_MALE_VOICE_POOL,
    female: envVoiceList('ELEVENLABS_VOICE_ID_FEMALE') ?? DEFAULT_FEMALE_VOICE_POOL,
    narrator: process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID,
  }
}

/**
 * 화자 라벨 → 보이스 id 매핑(멀티보이스 캐스팅).
 * 같은 스크립트는 같은 캐스팅(seed 고정), 스크립트마다 조합이 달라진다.
 * 같은 성별 다중 화자(男1/男2)는 풀에서 서로 다른 보이스를 받는다.
 */
export function assignSpeakerVoices(
  speakers: { label: string; speaker: 'male' | 'female' | 'narrator' }[],
  seed: number,
  pools: VoicePools = getVoicePools(),
): Record<string, string> {
  const map: Record<string, string> = {}
  let mi = 0
  let fi = 0
  for (const s of speakers) {
    if (map[s.label]) continue
    if (s.speaker === 'male') {
      map[s.label] = pools.male[(seed + mi) % pools.male.length]
      mi++
    } else if (s.speaker === 'female') {
      map[s.label] = pools.female[(seed + fi) % pools.female.length]
      fi++
    } else {
      map[s.label] = pools.narrator
    }
  }
  return map
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
