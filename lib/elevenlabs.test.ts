import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildTtsRequest,
  isElevenLabsConfigured,
  synthesizeSpeech,
  ElevenLabsError,
  TTS_MAX_CHARS,
} from './elevenlabs'

const ORIG = process.env.ELEVENLABS_API_KEY
const ORIG_VOICE = process.env.ELEVENLABS_VOICE_ID

afterEach(() => {
  process.env.ELEVENLABS_API_KEY = ORIG
  process.env.ELEVENLABS_VOICE_ID = ORIG_VOICE
  vi.unstubAllGlobals()
})

describe('buildTtsRequest()', () => {
  it('voiceId·모델·헤더·본문을 구성', () => {
    const req = buildTtsRequest('你好', { apiKey: 'k1', voiceId: 'v1', modelId: 'm1' })
    expect(req.url).toContain('/text-to-speech/v1')
    expect(req.url).toContain('output_format=mp3_44100_128')
    expect(req.headers['xi-api-key']).toBe('k1')
    expect(req.headers.Accept).toBe('audio/mpeg')
    const body = JSON.parse(req.body)
    expect(body.text).toBe('你好')
    expect(body.model_id).toBe('m1')
  })

  it('voiceId 는 env 로 재정의 가능', () => {
    process.env.ELEVENLABS_VOICE_ID = 'envVoice'
    const req = buildTtsRequest('x', { apiKey: 'k' })
    expect(req.url).toContain('/text-to-speech/envVoice')
  })
})

describe('isElevenLabsConfigured()', () => {
  it('키 유무를 반영', () => {
    process.env.ELEVENLABS_API_KEY = 'set'
    expect(isElevenLabsConfigured()).toBe(true)
    delete process.env.ELEVENLABS_API_KEY
    expect(isElevenLabsConfigured()).toBe(false)
  })
})

describe('synthesizeSpeech()', () => {
  it('키 미설정 → 503 ElevenLabsError', async () => {
    delete process.env.ELEVENLABS_API_KEY
    await expect(synthesizeSpeech('你好')).rejects.toMatchObject({ status: 503 })
  })

  it('빈 텍스트 → 400', async () => {
    await expect(synthesizeSpeech('   ', { apiKey: 'k' })).rejects.toMatchObject({ status: 400 })
  })

  it('너무 긴 텍스트 → 400', async () => {
    const long = 'a'.repeat(TTS_MAX_CHARS + 1)
    await expect(synthesizeSpeech(long, { apiKey: 'k' })).rejects.toMatchObject({ status: 400 })
  })

  it('성공 시 오디오 버퍼 반환', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
      headers: { get: () => 'audio/mpeg' },
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await synthesizeSpeech('你好', { apiKey: 'k' })
    expect(res.audio.byteLength).toBe(16)
    expect(res.contentType).toBe('audio/mpeg')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('실패 응답 → 상태코드 담은 ElevenLabsError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' }),
    )
    await expect(synthesizeSpeech('你好', { apiKey: 'k' })).rejects.toBeInstanceOf(ElevenLabsError)
    await expect(synthesizeSpeech('你好', { apiKey: 'k' })).rejects.toMatchObject({ status: 401 })
  })
})
