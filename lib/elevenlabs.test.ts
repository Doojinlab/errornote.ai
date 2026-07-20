import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildTtsRequest,
  isElevenLabsConfigured,
  synthesizeSpeech,
  assignSpeakerVoices,
  assignCastVoices,
  pickBrightVoice,
  BRIGHT_VOICE_SETTINGS,
  type VoiceCatalog,
  ElevenLabsError,
  TTS_MAX_CHARS,
} from './elevenlabs'

const POOLS = { male: ['M1', 'M2', 'M3'], female: ['F1', 'F2'], narrator: 'N' }

const CATALOG: VoiceCatalog = {
  male: { child: ['MC'], young: ['MY1', 'MY2'], adult: ['MA1', 'MA2'], senior: ['MS'] },
  female: { child: ['FC'], young: ['FY'], adult: ['FA1', 'FA2'], senior: ['FS'] },
}

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

  it('voiceSettings 재정의(밝은 톤) 를 본문에 반영', () => {
    const req = buildTtsRequest('你好', { apiKey: 'k', voiceSettings: { ...BRIGHT_VOICE_SETTINGS } })
    const body = JSON.parse(req.body)
    expect(body.voice_settings).toMatchObject(BRIGHT_VOICE_SETTINGS)
  })

  it('voiceSettings 미지정 시 기본값', () => {
    const req = buildTtsRequest('你好', { apiKey: 'k' })
    const body = JSON.parse(req.body)
    expect(body.voice_settings).toEqual({ stability: 0.5, similarity_boost: 0.75 })
  })
})

describe('pickBrightVoice()', () => {
  const POOL = ['B1', 'B2', 'B3']

  it('seed 로 풀에서 순환 선택 — 다른 seed=다른 음성', () => {
    expect(pickBrightVoice(0, POOL)).toBe('B1')
    expect(pickBrightVoice(1, POOL)).toBe('B2')
    expect(pickBrightVoice(2, POOL)).toBe('B3')
    expect(pickBrightVoice(3, POOL)).toBe('B1') // 풀 크기로 순환
  })

  it('음수·실수 seed 도 안전하게 처리', () => {
    expect(pickBrightVoice(-1, POOL)).toBe('B3')
    expect(pickBrightVoice(1.9, POOL)).toBe('B2')
    expect(pickBrightVoice(NaN, POOL)).toBe('B1')
  })

  it('빈 풀이면 내레이터 보이스로 폴백', () => {
    process.env.ELEVENLABS_VOICE_ID = 'NARR'
    expect(pickBrightVoice(0, [])).toBe('NARR')
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

describe('assignSpeakerVoices()', () => {
  it('같은 라벨=같은 보이스, 같은 성별 다중 화자=다른 보이스', () => {
    const map = assignSpeakerVoices(
      [
        { label: '男1', speaker: 'male' },
        { label: '女', speaker: 'female' },
        { label: '男2', speaker: 'male' },
        { label: '男1', speaker: 'male' },
      ],
      0,
      POOLS,
    )
    expect(map['男1']).toBe('M1')
    expect(map['男2']).toBe('M2') // 같은 성별 다른 화자 → 다른 보이스
    expect(map['女']).toBe('F1')
  })

  it('seed 가 다르면 캐스팅이 로테이션', () => {
    const one = [{ label: '男', speaker: 'male' as const }]
    expect(assignSpeakerVoices(one, 0, POOLS)['男']).toBe('M1')
    expect(assignSpeakerVoices(one, 1, POOLS)['男']).toBe('M2')
    expect(assignSpeakerVoices(one, 3, POOLS)['男']).toBe('M1') // 풀 크기(3)로 순환
  })

  it('narrator 는 내레이터 보이스', () => {
    expect(assignSpeakerVoices([{ label: 'narrator', speaker: 'narrator' }], 5, POOLS).narrator).toBe('N')
  })
})

describe('assignCastVoices()', () => {
  it('성별×연령 버킷에서 배정 — 노인/성인 등 특성별로 다른 보이스', () => {
    const map = assignCastVoices(
      [
        { label: '男', gender: 'male', age: 'senior' },
        { label: '女', gender: 'female', age: 'adult' },
      ],
      0,
      CATALOG,
    )
    expect(map['男']).toBe('MS') // 남성 노인
    expect(map['女']).toBe('FA1') // 여성 성인
  })

  it('같은 버킷 다중 화자는 서로 다른 보이스', () => {
    const map = assignCastVoices(
      [
        { label: '男1', gender: 'male', age: 'adult' },
        { label: '男2', gender: 'male', age: 'adult' },
      ],
      0,
      CATALOG,
    )
    expect(map['男1']).toBe('MA1')
    expect(map['男2']).toBe('MA2')
  })

  it('버킷 풀이 비면 같은 성별 adult 로 폴백', () => {
    const sparse: VoiceCatalog = {
      male: { child: [], young: [], adult: ['MA1'], senior: [] },
      female: { child: [], young: [], adult: ['FA1'], senior: [] },
    }
    const map = assignCastVoices([{ label: '男', gender: 'male', age: 'child' }], 0, sparse)
    expect(map['男']).toBe('MA1')
  })
})
