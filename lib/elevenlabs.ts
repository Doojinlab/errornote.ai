// ElevenLabs TTS 클라이언트 — 중국어 텍스트(듣기 대본·热词 등)를 음성으로 합성한다.
// 서버 전용(app/api/tts). ELEVENLABS_API_KEY 없으면 비활성(호출처에서 503 폴백).
//
// 요청 구성(buildTtsRequest)은 순수 함수로 분리해 단위검증한다.

import type { SpeakerAge } from '@/types/hsk'

const TTS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'
// 기본 보이스(내레이션·단일 발화, 예: 热词 발음). 네이티브 중국 성우. ELEVENLABS_VOICE_ID 로 재정의.
const DEFAULT_VOICE_ID = 'JZLpE3AGwpKYZI2X65hN' // 중국 여성

// 대화 멀티보이스 — 성별별 네이티브 중국 성우 풀(cast 없는 대본용 폴백).
// 스크립트마다 풀에서 다른 조합을 골라 "다양한 성우"를 자동 배정한다.
// env(쉼표 목록)로 교체 가능.
const DEFAULT_MALE_VOICE_POOL = [
  'cwzmKSYMCC9Aym1ymCnt',
  'agczkAUlHLowaNnL72Cc',
  'nss5M23ZSzhG3Tn0b7wN',
  'hFamrilbAE6WDMtWgKvu',
  'vZZLclMx4wouUtKBRfZn',
  'DowyQ68vDpgFYdWVGjc3',
  'fYmV8EanqZP9BI4WvpB7',
  'BWN0mOtkGHghA3CYFzFK',
  'bZtjnyJAFD0Cp3lfNG5g',
  'W8lBaQb9YIoddhxfQNLP',
  'xh2OInDk4GEYuYRtHx4M',
]
const DEFAULT_FEMALE_VOICE_POOL = [
  'JZLpE3AGwpKYZI2X65hN',
  '9lHjugDhwqoxA5MhX0az',
  'kAIqZ7fZv234ClKXwzDx',
  'YxbjaPemDJV2xlfvkiIG',
  'ByhETIclHirOlWnWKhHc',
  'BqljjWyTnrioXPCNkCd4',
  'bhJUNIXWQQ94l8eI2VUf',
  'm7QGIiNrWASyI5oJn4I8',
  'ggacvEjbmpoSuEinfFWs',
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

// ── 방식 B: 연령·성별 특성 카탈로그(지문 맞춤 캐스팅) ─────────────────────────
// 화자의 (성별 × 연령)에 맞는 보이스 풀. 프리메이드 기본값 — 실제 중국 성우 ID 가 있으면
// 버킷별 env(ELEVENLABS_VOICES_MALE_SENIOR 등, 쉼표 목록)로 교체하면 품질이 올라간다.
export type VoiceCatalog = Record<'male' | 'female', Record<SpeakerAge, string[]>>

// 네이티브 중국 성우를 (성별×연령) 버킷에 분배. ⚠️ 제공된 ID 에 나이 정보가 없어 분배는
// 임의(근사)다 — 실제 나이대를 알려주면 정확히 재배치. 버킷별 env(쉼표목록)로 재정의 가능.
const DEFAULT_VOICE_CATALOG: VoiceCatalog = {
  male: {
    child: ['cwzmKSYMCC9Aym1ymCnt', 'agczkAUlHLowaNnL72Cc'],
    young: ['nss5M23ZSzhG3Tn0b7wN', 'hFamrilbAE6WDMtWgKvu', 'vZZLclMx4wouUtKBRfZn'],
    adult: ['DowyQ68vDpgFYdWVGjc3', 'fYmV8EanqZP9BI4WvpB7', 'BWN0mOtkGHghA3CYFzFK'],
    senior: ['bZtjnyJAFD0Cp3lfNG5g', 'W8lBaQb9YIoddhxfQNLP', 'xh2OInDk4GEYuYRtHx4M'],
  },
  female: {
    child: ['JZLpE3AGwpKYZI2X65hN', '9lHjugDhwqoxA5MhX0az'],
    young: ['kAIqZ7fZv234ClKXwzDx', 'YxbjaPemDJV2xlfvkiIG'],
    adult: ['ByhETIclHirOlWnWKhHc', 'BqljjWyTnrioXPCNkCd4', 'bhJUNIXWQQ94l8eI2VUf'],
    senior: ['m7QGIiNrWASyI5oJn4I8', 'ggacvEjbmpoSuEinfFWs'],
  },
}

const AGE_BUCKETS: readonly SpeakerAge[] = ['child', 'young', 'adult', 'senior']

/** (성별 × 연령) 보이스 카탈로그. 버킷별 env(쉼표 목록)로 재정의 가능. */
export function getVoiceCatalog(): VoiceCatalog {
  const build = (gender: 'male' | 'female'): Record<SpeakerAge, string[]> => {
    const g = DEFAULT_VOICE_CATALOG[gender]
    const out = {} as Record<SpeakerAge, string[]>
    for (const age of AGE_BUCKETS) {
      out[age] = envVoiceList(`ELEVENLABS_VOICES_${gender.toUpperCase()}_${age.toUpperCase()}`) ?? g[age]
    }
    return out
  }
  return { male: build('male'), female: build('female') }
}

/**
 * 화자 캐스팅(방식 B) → 라벨별 보이스 id. 각 화자의 (성별×연령) 버킷 풀에서 배정한다.
 * 같은 라벨=같은 보이스, 같은 버킷의 다른 화자는 서로 다른 보이스, 스크립트마다 조합 로테이션(seed).
 * 버킷 풀이 비면 같은 성별 adult → 최후엔 남성 adult 로 폴백.
 */
export function assignCastVoices(
  cast: { label: string; gender: 'male' | 'female'; age: SpeakerAge }[],
  seed: number,
  catalog: VoiceCatalog = getVoiceCatalog(),
): Record<string, string> {
  const map: Record<string, string> = {}
  const counters: Record<string, number> = {}
  for (const s of cast) {
    if (map[s.label]) continue
    const byAge = catalog[s.gender]
    const pool =
      byAge[s.age]?.length ? byAge[s.age] : byAge.adult?.length ? byAge.adult : catalog.male.adult
    const key = `${s.gender}:${s.age}`
    const idx = counters[key] ?? 0
    counters[key] = idx + 1
    map[s.label] = pool[(seed + idx) % pool.length]
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
