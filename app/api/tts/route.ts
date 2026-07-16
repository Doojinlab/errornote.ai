import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  isElevenLabsConfigured,
  synthesizeSpeech,
  assignSpeakerVoices,
  assignCastVoices,
  ElevenLabsError,
  TTS_MAX_CHARS,
} from '@/lib/elevenlabs'
import { extractSpokenChinese, parseDialogueTurns, hashString } from '@/lib/tts'
import type { SpeakerAge } from '@/types/hsk'

export const runtime = 'nodejs'
export const maxDuration = 30

const AGES: readonly SpeakerAge[] = ['child', 'young', 'adult', 'senior']

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
      // 화자별 보이스로 각 발화를 병렬 합성 후 순서대로 이어붙인다.
      const parts = await Promise.all(
        turns.map((t) => synthesizeSpeech(t.spoken, { voiceId: voiceByLabel[t.label] })),
      )
      const combined = Buffer.concat(parts.map((p) => Buffer.from(p.audio)))
      return new Response(combined, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
      })
    }

    const { audio, contentType } = await synthesizeSpeech(turns.map((t) => t.spoken).join(' '))
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
