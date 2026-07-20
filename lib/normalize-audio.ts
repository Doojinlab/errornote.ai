// 브라우저 Web Audio 로 오디오 blob 을 "라우드니스 정규화 + 부스트"해서 재생한다.
// 성우(보이스)마다 볼륨이 제각각인 문제를 없애 항상 같은 높낮이로, 그리고 크게 들리게 한다.
// ElevenLabs 요금제(PCM 출력 지원 여부)와 무관하게 클라이언트에서 처리하므로 안전하다.
// 클라이언트 전용 — 서버에서 import 하지 말 것(window/AudioContext 사용).

// 정규화 목표(정규화 범위 -1~1 기준). RMS 를 목표로 맞추되 피크가 상한을 넘지 않게 gain 을 제한한다.
// (조용한 클립은 키우고, 큰 클립은 낮춰 균일화 + 전체적으로 크게.)
const DEFAULT_TARGET_RMS = 0.2; // 균일화 + 크게(요청: 살짝 더 크게). 더 키우려면 이 값을 올린다.
const DEFAULT_TARGET_PEAK = 0.99; // 클리핑 방지 상한

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

/**
 * blob(오디오)을 라우드니스 정규화 + 부스트해서 재생한다. 재생이 끝나면 resolve.
 * Web Audio 미지원(구형 브라우저 등)이면 일반 재생으로 폴백한다.
 */
export async function playNormalized(
  blob: Blob,
  opts: { targetRms?: number; targetPeak?: number } = {},
): Promise<void> {
  const targetRms = opts.targetRms ?? DEFAULT_TARGET_RMS;
  const targetPeak = opts.targetPeak ?? DEFAULT_TARGET_PEAK;

  const ctx = getCtx();
  if (!ctx) {
    // Web Audio 미지원 → 일반 재생 폴백(정규화는 못 하지만 재생은 된다).
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return;
  }
  if (ctx.state === "suspended") await ctx.resume();

  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());

  // 전 채널에서 RMS·peak 측정.
  let sumSq = 0;
  let peak = 0;
  let count = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      sumSq += s * s;
      const a = s < 0 ? -s : s;
      if (a > peak) peak = a;
    }
    count += data.length;
  }
  const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
  // 목표 RMS 로 맞추되, 피크가 상한을 넘지 않도록 gain 제한(클리핑 방지).
  const gain = rms > 0 && peak > 0 ? Math.min(targetRms / rms, targetPeak / peak) : 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ctx.destination);

  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
    src.start();
  });
}
