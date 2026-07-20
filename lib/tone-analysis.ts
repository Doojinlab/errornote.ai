// 중국어 성조(声调) 실측 분석 — gamification-spec / 발음 연습.
// 마이크로 녹음한 단음절 오디오의 기본주파수(F0) 피치 곡선을 실제로 추출해
// 성조(1성 고평 / 2성 상승 / 3성 저강하 / 4성 하강)를 분류한다.
//
// 이 모듈은 순수 함수만 담는다(Web Audio·DOM 의존 없음) → 합성 신호로 단위 검증 가능.
// 오디오 캡처(getUserMedia/AudioContext)는 클라이언트 컴포넌트가 담당하고,
// 여기서는 Float32 PCM 샘플 배열만 입력받는다.

export type ChineseTone = 1 | 2 | 3 | 4

export interface PitchDetectOptions {
  /** 사람 목소리 하한(Hz) */
  minHz?: number
  /** 사람 목소리 상한(Hz) */
  maxHz?: number
  /** 무성/무음 판정 RMS 게이트(0~1) */
  rmsGate?: number
  /** 정규화 자기상관 유성 판정 임계(0~1) */
  clarity?: number
}

const DEFAULT_MIN_HZ = 70
const DEFAULT_MAX_HZ = 400
const DEFAULT_RMS_GATE = 0.01
const DEFAULT_CLARITY = 0.5

/**
 * 한 프레임의 기본주파수(F0)를 자기상관(ACF)으로 추정한다.
 * 무성·무음이거나 명료도가 낮으면 null.
 */
export function detectPitchHz(
  samples: Float32Array | number[],
  sampleRate: number,
  opts: PitchDetectOptions = {}
): number | null {
  const minHz = opts.minHz ?? DEFAULT_MIN_HZ
  const maxHz = opts.maxHz ?? DEFAULT_MAX_HZ
  const rmsGate = opts.rmsGate ?? DEFAULT_RMS_GATE
  const clarity = opts.clarity ?? DEFAULT_CLARITY

  const n = samples.length
  if (n === 0 || sampleRate <= 0) return null

  // RMS 게이트 — 너무 조용하면 무음 처리
  let energy = 0
  for (let i = 0; i < n; i++) energy += samples[i] * samples[i]
  const rms = Math.sqrt(energy / n)
  if (rms < rmsGate) return null
  if (energy === 0) return null

  const minLag = Math.max(1, Math.floor(sampleRate / maxHz))
  const maxLag = Math.min(n - 1, Math.floor(sampleRate / minHz))
  if (maxLag <= minLag) return null

  // lag 0 자기상관(에너지) = 정규화 기준
  const acf: number[] = new Array(maxLag + 1).fill(0)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) sum += samples[i] * samples[i + lag]
    acf[lag] = sum
  }

  // 첫 번째 골(negative dip)을 지난 뒤의 최대 피크를 찾는다(옥타브 오류 완화).
  let bestLag = -1
  let bestVal = -Infinity
  let seenDip = false
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (!seenDip) {
      if (acf[lag] < 0) seenDip = true
      continue
    }
    if (acf[lag] > bestVal) {
      bestVal = acf[lag]
      bestLag = lag
    }
  }
  // dip 을 못 본 경우(순수 저주파)엔 전체 구간 최대치로 폴백
  if (bestLag < 0) {
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (acf[lag] > bestVal) {
        bestVal = acf[lag]
        bestLag = lag
      }
    }
  }
  if (bestLag <= 0) return null

  // 명료도 = 피크 정규화 자기상관 / 에너지
  const normalized = bestVal / energy
  if (normalized < clarity) return null

  // 포물선 보간으로 서브샘플 정밀도 향상
  const y0 = acf[bestLag - 1] ?? bestVal
  const y1 = bestVal
  const y2 = acf[bestLag + 1] ?? bestVal
  const denom = y0 - 2 * y1 + y2
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0
  const refinedLag = bestLag + Math.max(-1, Math.min(1, shift))

  return sampleRate / refinedLag
}

export interface ContourOptions extends PitchDetectOptions {
  /** 프레임 길이(ms) */
  frameMs?: number
  /** 프레임 이동(ms) */
  hopMs?: number
}

/**
 * 오디오 전체를 프레임 단위로 훑어 유성 프레임의 F0(Hz) 곡선을 만든다.
 * 무성/무음 프레임은 건너뛴다.
 */
export function computePitchContour(
  samples: Float32Array | number[],
  sampleRate: number,
  opts: ContourOptions = {}
): number[] {
  const frameMs = opts.frameMs ?? 40
  const hopMs = opts.hopMs ?? 20
  const frameLen = Math.max(1, Math.floor((sampleRate * frameMs) / 1000))
  const hop = Math.max(1, Math.floor((sampleRate * hopMs) / 1000))

  const contour: number[] = []
  for (let start = 0; start + frameLen <= samples.length; start += hop) {
    const frame =
      samples instanceof Float32Array
        ? samples.subarray(start, start + frameLen)
        : samples.slice(start, start + frameLen)
    const hz = detectPitchHz(frame, sampleRate, opts)
    if (hz !== null && Number.isFinite(hz)) contour.push(hz)
  }
  return medianSmooth(contour, 3)
}

/** 이동 중앙값 필터(옥타브 튐·이상치 완화). window 는 홀수 권장. */
export function medianSmooth(values: number[], window = 3): number[] {
  if (values.length === 0 || window <= 1) return values.slice()
  const half = Math.floor(window / 2)
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(0, i - half)
    const hi = Math.min(values.length - 1, i + half)
    const slice = values.slice(lo, hi + 1).sort((a, b) => a - b)
    out.push(slice[Math.floor(slice.length / 2)])
  }
  return out
}

/** Hz → 세미톤(기준 대비 상대값). ref 는 임의(비교만 하므로). */
function hzToSemitone(hz: number, ref: number): number {
  return 12 * Math.log2(hz / ref)
}

/**
 * Hz 곡선을 고정 길이 정규화 세미톤 곡선(0~1)으로 변환한다(시각화·분류 공용).
 * 곡선이 너무 짧으면 null.
 */
export function normalizeContour(hzContour: number[], length = 9): number[] | null {
  const valid = hzContour.filter((h) => Number.isFinite(h) && h > 0)
  if (valid.length < 2) return null

  const ref = valid[0]
  const semis = valid.map((h) => hzToSemitone(h, ref))

  // 고정 길이로 선형 리샘플
  const resampled: number[] = []
  for (let i = 0; i < length; i++) {
    const pos = (i / (length - 1)) * (semis.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const frac = pos - lo
    resampled.push(semis[lo] * (1 - frac) + semis[hi] * frac)
  }

  const min = Math.min(...resampled)
  const max = Math.max(...resampled)
  if (max - min < 1e-6) return resampled.map(() => 0.5)
  return resampled.map((v) => (v - min) / (max - min))
}

export interface ToneClassifyOptions {
  /** 1성(고평) 판정: 전체 음역(세미톤) 상한 */
  flatRangeSemi?: number
  /** 상승/하강 판정 기울기(세미톤) */
  slopeSemi?: number
  /** 3성 골 깊이(정규화 0~1) */
  dipDepth?: number
}

const DEFAULT_FLAT_RANGE_SEMI = 3
const DEFAULT_SLOPE_SEMI = 2
const DEFAULT_DIP_DEPTH = 0.25

/**
 * F0(Hz) 곡선에서 중국어 성조를 분류한다. 판정 불가면 null.
 * 1성 고평 / 2성 상승 / 3성 저강하(골) / 4성 하강.
 */
export function classifyToneFromContour(
  hzContour: number[],
  opts: ToneClassifyOptions = {}
): ChineseTone | null {
  const flatRange = opts.flatRangeSemi ?? DEFAULT_FLAT_RANGE_SEMI
  const slopeTh = opts.slopeSemi ?? DEFAULT_SLOPE_SEMI
  const dipTh = opts.dipDepth ?? DEFAULT_DIP_DEPTH

  const valid = hzContour.filter((h) => Number.isFinite(h) && h > 0)
  if (valid.length < 3) return null

  // 세미톤 기울기·음역 (원시 곡선 기준)
  const ref = valid[0]
  const semis = valid.map((h) => hzToSemitone(h, ref))
  const slopeSemi = semis[semis.length - 1] - semis[0]
  const rangeSemi = Math.max(...semis) - Math.min(...semis)

  // 1성: 거의 평평(음역이 좁고 기울기 작음). 먼저 판정해 미세잡음이
  // 정규화로 증폭돼 3성 골로 오검출되는 것을 막는다.
  if (rangeSemi < flatRange && Math.abs(slopeSemi) < slopeTh) return 1

  // 정규화 곡선으로 골(dip) 분석 — 여기부터는 음역이 충분히 넓은 곡선.
  const norm = normalizeContour(valid)
  if (!norm) return null
  let minIdx = 0
  for (let i = 1; i < norm.length; i++) if (norm[i] < norm[minIdx]) minIdx = i
  const minFrac = minIdx / (norm.length - 1)
  const endsMin = Math.min(norm[0], norm[norm.length - 1])
  const dipDepth = endsMin - norm[minIdx] // 양 끝보다 얼마나 더 내려가는가

  // 3성: 내부에 뚜렷한 골(양 끝이 골보다 충분히 높음)
  const hasInteriorDip = minFrac > 0.15 && minFrac < 0.85 && dipDepth >= dipTh
  if (hasInteriorDip && Math.abs(slopeSemi) < slopeTh + 2) return 3

  // 2성 상승 / 4성 하강
  if (slopeSemi >= slopeTh) return 2
  if (slopeSemi <= -slopeTh) return 4

  // 애매하면 골 우선, 아니면 기울기 부호로 폴백
  if (hasInteriorDip) return 3
  return slopeSemi >= 0 ? 2 : 4
}

const TONE_DIACRITICS: Record<string, ChineseTone> = {
  // 1성
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1, Ā: 1, Ē: 1, Ī: 1, Ō: 1, Ū: 1,
  // 2성
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2, Á: 2, É: 2, Í: 2, Ó: 2, Ú: 2,
  // 3성
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3, Ǎ: 3, Ě: 3, Ǐ: 3, Ǒ: 3, Ǔ: 3,
  // 4성
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4, À: 4, È: 4, Ì: 4, Ò: 4, Ù: 4,
}

/**
 * 병음 음절의 성조 번호를 뽑는다. 성조부호(mā) 또는 숫자표기(ma1) 모두 지원.
 * 경성/판정 불가 → 0.
 */
export function parsePinyinTone(syllable: string): 0 | ChineseTone {
  if (!syllable) return 0
  // 숫자 표기 우선(ma1, ma3)
  const digit = syllable.trim().match(/[1-5]\s*$/)
  if (digit) {
    const t = Number(digit[0].trim())
    return t >= 1 && t <= 4 ? (t as ChineseTone) : 0
  }
  // 성조부호
  for (const ch of syllable) {
    const t = TONE_DIACRITICS[ch]
    if (t) return t
  }
  return 0
}

export interface ToneJudgement {
  target: ChineseTone
  detected: ChineseTone | null
  correct: boolean
}

/** 목표 성조와 실측 F0 곡선을 비교해 정오를 판정한다. */
export function judgeTone(
  target: ChineseTone,
  hzContour: number[],
  opts: ToneClassifyOptions = {}
): ToneJudgement {
  const detected = classifyToneFromContour(hzContour, opts)
  return { target, detected, correct: detected === target }
}
