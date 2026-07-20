import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  isElevenLabsConfigured,
  synthesizeSpeech,
  assignSpeakerVoices,
  assignCastVoices,
  pickBrightVoice,
  BRIGHT_VOICE_SETTINGS,
  ElevenLabsError,
  TTS_MAX_CHARS,
} from '@/lib/elevenlabs'
import { extractSpokenChinese, parseDialogueTurns, hashString } from '@/lib/tts'
import { TTS_PCM_SAMPLE_RATE, pcmBufferToInt16, normalizePcm, pcmSegmentsToWav } from '@/lib/audio'
import type { SpeakerAge } from '@/types/hsk'

export const runtime = 'nodejs'
export const maxDuration = 30

const AGES: readonly SpeakerAge[] = ['child', 'young', 'adult', 'senior']

// 멀티보이스 화자별 합성의 동시 호출 수(ElevenLabs tier 동시요청 한도 회피 — 예: Creator≈5).
// 기본 3(안전 마진). env TTS_CONCURRENCY 로 조정.
const TTS_CONCURRENCY = (() => {
  const v = Number(process.env.TTS_CONCURRENCY)
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 3
})()

/** 동시 실행 수를 limit 로 제한해 순서 보존 매핑. 한 건이라도 실패하면 남은 작업을 멈추고 throw. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let aborted = false
  const worker = async () => {
    while (!aborted) {
      const i = next++
      if (i >= items.length) return
      try {
        results[i] = await fn(items[i], i)
      } catch (err) {
        aborted = true
        throw err
      }
    }
  }
  const n = Math.max(1, Math.min(limit, items.length || 1))
  await Promise.all(Array.from({ length: n }, worker))
  return results
}

/** body.cast(방식 B 캐스팅)를 검증·정규화. 없거나 잘못되면 빈 배열(성별 풀 폴백). */
function parseBodyCast(body: unknown): { label: string; gender: 'male' | 'female'; age: SpeakerAge }[] {
  const arr = (body as { cast?: unknown })?.cast
  if (!Array.isArray(arr)) return []
  const out: { label: string; gender: 'male' | 'female'; age: SpeakerAge }[] = []
  for (const s of arr) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    const gender = o.gender === 'male' || o.gender === 'female' ? o.gender : null
    if (!label || !gender) continue
    const age = AGES.includes(o.age as SpeakerAge) ? (o.age as SpeakerAge) : 'adult'
    out.push({ label, gender, age })
  }
  return out
}

// 공용 TTS — 중국어 텍스트를 음성(mp3)으로 합성(ElevenLabs). 듣기 지문·热词 발음 공용.
// 한글·라틴은 제거해 중국어만 읽는다(오발음 방지). 키 미설정 시 503(code: tts_unconfigured).
// 대화 대본(男：/女：)은 화자별로 나눠 서로 다른 보이스로 합성 후 mp3 를 이어붙인다(멀티보이스).
export async function POST(req: Request): Promise<Response> {
  try {
    await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const raw = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text : ''

  // 화자 표기 기준으로 분할(男/女/男1…). 표기 없으면 narrator 한 덩어리 → 단일 보이스.
  const turns = parseDialogueTurns(raw)
    .map((t) => ({ speaker: t.speaker, label: t.label, spoken: extractSpokenChinese(t.text) }))
    .filter((t) => t.spoken)

  const totalChars = turns.reduce((s, t) => s + t.spoken.length, 0)
  if (totalChars === 0) {
    return NextResponse.json({ error: '읽을 중국어 텍스트가 없습니다' }, { status: 400 })
  }
  if (totalChars > TTS_MAX_CHARS) {
    return NextResponse.json({ error: `text 는 최대 ${TTS_MAX_CHARS}자까지 지원합니다` }, { status: 400 })
  }

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { error: '듣기 음성이 아직 설정되지 않았습니다', code: 'tts_unconfigured' },
      { status: 503 },
    )
  }

  const multiVoice = turns.some((t) => t.speaker !== 'narrator')

  try {
    if (multiVoice) {
      // 스크립트별 캐스팅. cast(방식 B, 성별×연령)가 오면 특성 카탈로그로 배정하고,
      // cast 없거나 누락된 화자는 성별 풀로 폴백(스크립트마다 조합 로테이션).
      const seed = hashString(raw)
      const distinct = turns.map((t) => ({ label: t.label, speaker: t.speaker }))
      const bodyCast = parseBodyCast(body)
      const voiceByLabel = bodyCast.length
        ? { ...assignSpeakerVoices(distinct, seed), ...assignCastVoices(bodyCast, seed) }
        : assignSpeakerVoices(distinct, seed)

      const loudnessOn =
        process.env.TTS_MULTIVOICE_LOUDNESS !== '0' && process.env.TTS_MULTIVOICE_LOUDNESS !== 'off'

      // 화자별 합성은 동시 호출 수를 제한한다(ElevenLabs tier 동시요청 한도 → 429 회피).
      // 실패(PCM 미지원 tier·동시호출·순간 오류 등) 시 PCM → mp3 → 단일 보이스 순으로 단계적 폴백:
      // 대본을 통째로 노출하는 대신 음성이 계속 나오게 한다.

      // 1) 음량 정규화(PCM) 경로 — 성우가 바뀔 때 볼륨이 튀지 않게. PCM 미지원 tier 면 mp3 로 폴백.
      if (loudnessOn) {
        try {
          const parts = await mapWithConcurrency(turns, TTS_CONCURRENCY, (t) =>
            synthesizeSpeech(t.spoken, {
              voiceId: voiceByLabel[t.label],
              outputFormat: `pcm_${TTS_PCM_SAMPLE_RATE}`,
            }),
          )
          const segments = parts.map((p) => {
            const seg = pcmBufferToInt16(p.audio)
            normalizePcm(seg)
            return seg
          })
          return new Response(pcmSegmentsToWav(segments), {
            status: 200,
            headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
          })
        } catch (err) {
          console.error('[api/tts] 멀티보이스 PCM 실패 → mp3 폴백', err)
        }
      }

      // 2) mp3 이어붙이기(정규화 없음).
      try {
        const parts = await mapWithConcurrency(turns, TTS_CONCURRENCY, (t) =>
          synthesizeSpeech(t.spoken, { voiceId: voiceByLabel[t.label] }),
        )
        const combined = Buffer.concat(parts.map((p) => Buffer.from(p.audio)))
        return new Response(combined, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
        })
      } catch (err) {
        // 3) 최후: 아래 단일 발화(전체를 단일 보이스 mp3)로 낙하 — 热词처럼 확실히 되는 경로.
        console.error('[api/tts] 멀티보이스 mp3 실패 → 단일 보이스 폴백', err)
      }
    }

    // 단일 발화(热词 발음 등). voice:'bright' 면 밝은 하이톤 풀에서 랜덤으로 골라 다양한 음성으로 낸다.
    // seed 를 주면 그 값으로 고정, 없으면 매 요청 랜덤 → 새로고침·재생마다 다른 밝은 성우.
    const b = body as { voice?: unknown; seed?: unknown }
    const brightOpts =
      b.voice === 'bright'
        ? {
            voiceId: pickBrightVoice(
              typeof b.seed === 'number' ? b.seed : Math.floor(Math.random() * 1e9),
            ),
            voiceSettings: { ...BRIGHT_VOICE_SETTINGS },
          }
        : {}
    const { audio, contentType } = await synthesizeSpeech(turns.map((t) => t.spoken).join(' '), brightOpts)
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[api/tts]', err)
    if (err instanceof ElevenLabsError) {
      const code = err.status === 503 ? 'tts_unconfigured' : undefined
      return NextResponse.json({ error: err.message, code }, { status: err.status })
    }
    return NextResponse.json({ error: '음성 합성 실패' }, { status: 500 })
  }
}
