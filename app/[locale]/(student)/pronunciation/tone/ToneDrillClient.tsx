"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import Card from "@/components/ui/Card";
import {
  computePitchContour,
  judgeTone,
  normalizeContour,
  type ChineseTone,
} from "@/lib/tone-analysis";

interface Target {
  hanzi: string;
  pinyin: string;
  tone: ChineseTone;
}

// 성조 4개를 한눈에 대비시키는 고전 최소대립쌍 mā/má/mǎ/mà.
const TARGETS: Target[] = [
  { hanzi: "妈", pinyin: "mā", tone: 1 },
  { hanzi: "麻", pinyin: "má", tone: 2 },
  { hanzi: "马", pinyin: "mǎ", tone: 3 },
  { hanzi: "骂", pinyin: "mà", tone: 4 },
];

const RECORD_MS = 2000;

interface Result {
  target: ChineseTone;
  detected: ChineseTone | null;
  correct: boolean;
  curve: number[] | null;
}

type AudioCtor = typeof AudioContext;

function getAudioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ||
    null
  );
}

export default function ToneDrillClient() {
  const t = useTranslations("pages.student.tonePractice");

  const [supported, setSupported] = useState<boolean | null>(null);
  const [target, setTarget] = useState<Target>(TARGETS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR 하이드레이션 불일치 방지를 위해 마운트 후 1회 브라우저 오디오 지원 여부를 반영하는 의도적 effect
    setSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        !!getAudioContextCtor()
    );
    return () => cleanupRef.current?.();
  }, []);

  const toneName = (tone: ChineseTone): string => t(`tone${tone}`);

  const record = useCallback(async () => {
    setError(null);
    setResult(null);

    const Ctor = getAudioContextCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setError(t("unsupported"));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t("micDenied"));
      return;
    }

    const ctx = new Ctor();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];

    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      // 입력 채널을 복사해 누적(재사용 버퍼이므로 반드시 복사).
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    // 무음 게인으로 스피커 피드백 없이 processor 를 활성화.
    const silent = ctx.createGain();
    silent.gain.value = 0;
    source.connect(processor);
    processor.connect(silent);
    silent.connect(ctx.destination);

    const stop = () => {
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      silent.disconnect();
      stream.getTracks().forEach((tr) => tr.stop());
      void ctx.close();
    };
    cleanupRef.current = stop;

    setIsRecording(true);

    window.setTimeout(() => {
      const sampleRate = ctx.sampleRate;
      stop();
      cleanupRef.current = null;
      setIsRecording(false);
      setIsAnalyzing(true);

      // 청크 병합
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }

      const contour = computePitchContour(merged, sampleRate);
      if (contour.length < 3) {
        setError(t("noPitch"));
        setIsAnalyzing(false);
        return;
      }
      const j = judgeTone(target.tone, contour);
      setResult({
        target: j.target,
        detected: j.detected,
        correct: j.correct,
        curve: normalizeContour(contour, 24),
      });
      setIsAnalyzing(false);
    }, RECORD_MS);
  }, [target, t]);

  if (supported === false) {
    return (
      <Card className="p-6 text-center text-sm text-bodytx">{t("unsupported")}</Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-semibold text-bodytx">{t("pickTarget")}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TARGETS.map((tg) => {
            const selected = tg.pinyin === target.pinyin;
            return (
              <button
                key={tg.pinyin}
                type="button"
                onClick={() => {
                  setTarget(tg);
                  setResult(null);
                  setError(null);
                }}
                disabled={isRecording}
                className={`flex flex-col items-center rounded-xl2 border px-2 py-2 transition-colors ${
                  selected
                    ? "border-blue bg-blue-soft text-blue-dark"
                    : "border-hairline bg-white text-bodytx"
                }`}
              >
                <span lang="zh" className="font-cn text-xl text-ink">
                  {tg.hanzi}
                </span>
                <span className="mt-0.5 text-sm font-semibold">{tg.pinyin}</span>
                <span className="text-[10px] text-muted">{toneName(tg.tone)}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={record}
          disabled={isRecording || isAnalyzing}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-dark disabled:opacity-60"
        >
          <Mic size={16} aria-hidden />
          {isRecording ? t("recording") : isAnalyzing ? t("analyzing") : t("recordCta")}
        </button>

        {error && <p className="mt-2 text-xs text-terra">{error}</p>}
      </Card>

      {result && (
        <Card className="space-y-3 p-4">
          <div
            className={`rounded-xl2 px-4 py-3 text-center ${
              result.correct ? "bg-jade-soft text-jade-dark" : "bg-gold-soft text-gold-dark"
            }`}
          >
            <p className="text-sm font-extrabold">
              {result.correct ? t("correct") : t("wrong")}
            </p>
            <p className="mt-1 text-xs">
              {t("targetLabel")}: {toneName(result.target)}
              {" · "}
              {t("detectedLabel")}:{" "}
              {result.detected ? toneName(result.detected) : t("detectedNone")}
            </p>
          </div>

          {result.curve && <PitchCurve curve={result.curve} label={t("pitchCurve")} />}
        </Card>
      )}
    </div>
  );
}

function PitchCurve({ curve, label }: { curve: number[]; label: string }) {
  const w = 240;
  const h = 64;
  const pad = 6;
  const pts = curve
    .map((v, i) => {
      const x = pad + (i / (curve.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - v) * (h - 2 * pad); // v=1(고음) → 위쪽
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-muted">{label}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full rounded-md border border-hairline bg-ivory"
        role="img"
        aria-label={label}
      >
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-blue"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
