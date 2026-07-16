import { describe, it, expect } from 'vitest'
import {
  detectPitchHz,
  computePitchContour,
  classifyToneFromContour,
  normalizeContour,
  parsePinyinTone,
  judgeTone,
  medianSmooth,
} from './tone-analysis'

/** 지정 주파수 사인파 PCM 생성. */
function sine(freq: number, sampleRate: number, samples: number, amp = 0.5): Float32Array {
  const out = new Float32Array(samples)
  for (let i = 0; i < samples; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  return out
}

/** 시작→끝 주파수로 선형 스윕(글라이드) 사인파. */
function glide(f0: number, f1: number, sampleRate: number, samples: number, amp = 0.5): Float32Array {
  const out = new Float32Array(samples)
  let phase = 0
  for (let i = 0; i < samples; i++) {
    const f = f0 + ((f1 - f0) * i) / samples
    phase += (2 * Math.PI * f) / sampleRate
    out[i] = amp * Math.sin(phase)
  }
  return out
}

const SR = 16000

describe('detectPitchHz()', () => {
  it('순수 사인파의 기본주파수를 근사 추정', () => {
    const hz = detectPitchHz(sine(200, SR, 2048), SR)
    expect(hz).not.toBeNull()
    expect(Math.abs((hz as number) - 200)).toBeLessThan(6)
  })

  it('220Hz도 오차 범위 내', () => {
    const hz = detectPitchHz(sine(220, SR, 2048), SR)
    expect(Math.abs((hz as number) - 220)).toBeLessThan(6)
  })

  it('무음(0)은 null', () => {
    expect(detectPitchHz(new Float32Array(1024), SR)).toBeNull()
  })

  it('진폭이 게이트 이하이면 null', () => {
    expect(detectPitchHz(sine(200, SR, 1024, 0.0005), SR)).toBeNull()
  })
})

describe('computePitchContour()', () => {
  it('정상 사인 신호에서 유성 프레임 곡선을 만든다', () => {
    const contour = computePitchContour(sine(180, SR, SR / 2), SR)
    expect(contour.length).toBeGreaterThan(3)
    const avg = contour.reduce((a, b) => a + b, 0) / contour.length
    expect(Math.abs(avg - 180)).toBeLessThan(10)
  })
})

describe('classifyToneFromContour()', () => {
  it('평평한 곡선 → 1성(고평)', () => {
    const flat = Array.from({ length: 12 }, () => 220 + (Math.random() < 0.5 ? 1 : -1))
    expect(classifyToneFromContour(flat)).toBe(1)
  })

  it('상승 곡선 → 2성', () => {
    const rising = Array.from({ length: 12 }, (_, i) => 150 + (110 * i) / 11)
    expect(classifyToneFromContour(rising)).toBe(2)
  })

  it('V자 골 곡선 → 3성(저강하)', () => {
    const dip = [210, 185, 160, 140, 132, 140, 160, 190, 215]
    expect(classifyToneFromContour(dip)).toBe(3)
  })

  it('하강 곡선 → 4성', () => {
    const falling = Array.from({ length: 12 }, (_, i) => 260 - (110 * i) / 11)
    expect(classifyToneFromContour(falling)).toBe(4)
  })

  it('실측 글라이드(상승 스윕)에서 2성 검출', () => {
    const contour = computePitchContour(glide(150, 250, SR, SR), SR)
    expect(classifyToneFromContour(contour)).toBe(2)
  })

  it('너무 짧으면 null', () => {
    expect(classifyToneFromContour([200, 201])).toBeNull()
  })
})

describe('normalizeContour()', () => {
  it('0~1 범위로 정규화', () => {
    const norm = normalizeContour([100, 150, 200], 9)
    expect(norm).not.toBeNull()
    const n = norm as number[]
    expect(Math.min(...n)).toBeCloseTo(0, 5)
    expect(Math.max(...n)).toBeCloseTo(1, 5)
  })
})

describe('medianSmooth()', () => {
  it('단일 이상치를 완화', () => {
    const out = medianSmooth([200, 200, 400, 200, 200], 3)
    expect(out[2]).toBe(200)
  })
})

describe('parsePinyinTone()', () => {
  it('성조부호 인식', () => {
    expect(parsePinyinTone('mā')).toBe(1)
    expect(parsePinyinTone('má')).toBe(2)
    expect(parsePinyinTone('mǎ')).toBe(3)
    expect(parsePinyinTone('mà')).toBe(4)
  })
  it('숫자 표기 인식', () => {
    expect(parsePinyinTone('ma1')).toBe(1)
    expect(parsePinyinTone('hao3')).toBe(3)
  })
  it('경성/미지 → 0', () => {
    expect(parsePinyinTone('ma')).toBe(0)
    expect(parsePinyinTone('')).toBe(0)
  })
})

describe('judgeTone()', () => {
  it('목표 성조와 실측 곡선을 비교', () => {
    const rising = Array.from({ length: 12 }, (_, i) => 150 + (110 * i) / 11)
    const j = judgeTone(2, rising)
    expect(j).toEqual({ target: 2, detected: 2, correct: true })
  })
  it('불일치 시 correct=false', () => {
    const falling = Array.from({ length: 12 }, (_, i) => 260 - (110 * i) / 11)
    const j = judgeTone(1, falling)
    expect(j.correct).toBe(false)
    expect(j.detected).toBe(4)
  })
})
