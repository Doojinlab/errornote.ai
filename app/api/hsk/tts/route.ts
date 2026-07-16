import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  isElevenLabsConfigured,
  synthesizeSpeech,
  ElevenLabsError,
  TTS_MAX_CHARS,
} from '@/lib/elevenlabs'

export const runtime = 'nodejs'
export const maxDuration = 30

// HSK 듣기 대본 → 음성(mp3) 합성 (ElevenLabs).
// ELEVENLABS_API_KEY 미설정 시 503(code: tts_unconfigured) — 클라이언트가 대본 표시로 폴백.
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

  const text = typeof (body as { text?: unknown })?.text === 'string'
    ? (body as { text: string }).text.trim()
    : ''
  if (!text) {
    return NextResponse.json({ error: 'text 는 필수입니다' }, { status: 400 })
  }
  if (text.length > TTS_MAX_CHARS) {
    return NextResponse.json({ error: `text 는 최대 ${TTS_MAX_CHARS}자까지 지원합니다` }, { status: 400 })
  }

  if (!isElevenLabsConfigured()) {
    return NextResponse.json(
      { error: '듣기 음성이 아직 설정되지 않았습니다', code: 'tts_unconfigured' },
      { status: 503 },
    )
  }

  try {
    const { audio, contentType } = await synthesizeSpeech(text)
    return new Response(audio, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[api/hsk/tts]', err)
    if (err instanceof ElevenLabsError) {
      const code = err.status === 503 ? 'tts_unconfigured' : undefined
      return NextResponse.json({ error: err.message, code }, { status: err.status })
    }
    return NextResponse.json({ error: '음성 합성 실패' }, { status: 500 })
  }
}
