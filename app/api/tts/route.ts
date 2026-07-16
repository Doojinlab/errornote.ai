import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  isElevenLabsConfigured,
  synthesizeSpeech,
  ElevenLabsError,
  TTS_MAX_CHARS,
} from '@/lib/elevenlabs'
import { extractSpokenChinese } from '@/lib/tts'

export const runtime = 'nodejs'
export const maxDuration = 30

// 공용 TTS — 중국어 텍스트를 음성(mp3)으로 합성(ElevenLabs). 듣기 지문·热词 발음 공용.
// 한글·라틴은 제거해 중국어만 읽는다(오발음 방지). 키 미설정 시 503(code: tts_unconfigured).
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
  const text = extractSpokenChinese(raw)
  if (!text) {
    return NextResponse.json({ error: '읽을 중국어 텍스트가 없습니다' }, { status: 400 })
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
    console.error('[api/tts]', err)
    if (err instanceof ElevenLabsError) {
      const code = err.status === 503 ? 'tts_unconfigured' : undefined
      return NextResponse.json({ error: err.message, code }, { status: err.status })
    }
    return NextResponse.json({ error: '음성 합성 실패' }, { status: 500 })
  }
}
