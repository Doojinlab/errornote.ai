// TTS 멀티보이스 음량 정규화 유틸(순수). 화자별 세그먼트를 같은 라우드니스로 맞춰
// 이어붙일 때 볼륨이 튀지 않게 한다. 16-bit PCM(LE) mono 기준.
// (호스트 리틀엔디언 가정 — Node/x86. Vercel 서버리스 환경에 맞음.)

export const TTS_PCM_SAMPLE_RATE = 24000
const TARGET_RMS = 4500 // 약 -17 dBFS — 말소리 목표 라우드니스
const TARGET_PEAK = 30000 // 약 -0.8 dBFS — 클리핑 방지 상한

/**
 * ArrayBuffer(raw 16-bit LE PCM) → Int16Array 뷰. 홀수 바이트(불완전 샘플)는 버린다.
 */
export function pcmBufferToInt16(buf: ArrayBuffer): Int16Array {
  const usable = buf.byteLength - (buf.byteLength % 2)
  return new Int16Array(usable === buf.byteLength ? buf : buf.slice(0, usable))
}

/**
 * Int16 PCM 세그먼트를 목표 RMS 로 정규화한다(in-place). 단, 피크가 상한을 넘지 않도록
 * gain 을 제한해 클리핑을 막는다(조용한 세그먼트는 키우고, 큰 세그먼트는 낮춘다).
 */
export function normalizePcm(pcm: Int16Array, targetRms = TARGET_RMS, targetPeak = TARGET_PEAK): void {
  if (pcm.length === 0) return
  let sumSq = 0
  let peak = 0
  for (let i = 0; i < pcm.length; i++) {
    const s = pcm[i]
    sumSq += s * s
    const a = s < 0 ? -s : s
    if (a > peak) peak = a
  }
  const rms = Math.sqrt(sumSq / pcm.length)
  if (rms === 0 || peak === 0) return
  const gain = Math.min(targetRms / rms, targetPeak / peak)
  if (gain > 0.99 && gain < 1.01) return // 이미 목표에 가까우면 스킵
  for (let i = 0; i < pcm.length; i++) {
    let v = Math.round(pcm[i] * gain)
    if (v > 32767) v = 32767
    else if (v < -32768) v = -32768
    pcm[i] = v
  }
}

/** 정규화된 PCM 세그먼트들을 이어붙여 WAV(16-bit mono) Buffer 로 만든다. */
export function pcmSegmentsToWav(
  segments: Int16Array[],
  sampleRate = TTS_PCM_SAMPLE_RATE,
): Buffer<ArrayBuffer> {
  const totalSamples = segments.reduce((n, s) => n + s.length, 0)
  const merged = new Int16Array(totalSamples)
  let off = 0
  for (const s of segments) {
    merged.set(s, off)
    off += s.length
  }
  const dataBytes = merged.byteLength
  // 헤더 + 데이터를 하나의 Buffer 로(ArrayBuffer 백킹 보장 — Response 본문에 바로 사용 가능).
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16) // fmt chunk size
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate (mono·16bit = sr*2)
  buf.writeUInt16LE(2, 32) // block align
  buf.writeUInt16LE(16, 34) // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  buf.set(new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength), 44)
  return buf
}
