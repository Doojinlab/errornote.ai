import { describe, it, expect } from 'vitest'
import { normalizePcm, pcmSegmentsToWav, pcmBufferToInt16, TTS_PCM_SAMPLE_RATE } from './audio'

describe('normalizePcm()', () => {
  it('조용한 세그먼트를 목표 RMS 로 키운다', () => {
    const pcm = new Int16Array(1000).fill(200) // rms=peak=200
    normalizePcm(pcm) // gain = min(4500/200, 30000/200) = 22.5
    expect(pcm[0]).toBe(4500)
  })

  it('큰 세그먼트를 목표 RMS 로 낮춘다', () => {
    const pcm = new Int16Array(1000).fill(20000) // rms=peak=20000
    normalizePcm(pcm) // gain = min(4500/20000, 30000/20000) = 0.225
    expect(pcm[0]).toBe(4500)
  })

  it('피크 상한을 넘겨 클리핑하지 않는다', () => {
    // 스파이크가 있어도 피크 상한(30000)으로 gain 제한 → 32767 초과 없음
    const pcm = new Int16Array(1000).fill(500)
    pcm[0] = 25000
    normalizePcm(pcm)
    let max = 0
    for (const s of pcm) max = Math.max(max, Math.abs(s))
    expect(max).toBeLessThanOrEqual(30000)
  })

  it('빈 세그먼트는 그대로', () => {
    const pcm = new Int16Array(0)
    expect(() => normalizePcm(pcm)).not.toThrow()
  })
})

describe('pcmSegmentsToWav()', () => {
  it('WAV 헤더·데이터 길이가 올바르다', () => {
    const wav = pcmSegmentsToWav([new Int16Array([1, 2, 3]), new Int16Array([4, 5])])
    expect(wav.length).toBe(44 + 5 * 2) // 헤더 44 + 샘플 5개 × 2byte
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.toString('ascii', 36, 40)).toBe('data')
    expect(wav.readUInt32LE(40)).toBe(10) // dataBytes
    expect(wav.readUInt32LE(24)).toBe(TTS_PCM_SAMPLE_RATE) // sample rate
    expect(wav.readUInt16LE(22)).toBe(1) // mono
    expect(wav.readUInt16LE(34)).toBe(16) // 16-bit
  })
})

describe('pcmBufferToInt16()', () => {
  it('16-bit LE 바이트를 Int16Array 로', () => {
    const src = new Int16Array([100, -100, 32767])
    const out = pcmBufferToInt16(src.buffer)
    expect(Array.from(out)).toEqual([100, -100, 32767])
  })

  it('홀수 바이트(불완전 샘플)는 버린다', () => {
    const buf = new ArrayBuffer(5) // 2 샘플 + 1 바이트
    expect(pcmBufferToInt16(buf).length).toBe(2)
  })
})
