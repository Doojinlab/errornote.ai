"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Repeat, Gauge, ScrollText } from "lucide-react";
import { pinyinToneParts, toneTextClass } from "@/lib/pinyin-tone";
import { isSpeechSupported } from "@/lib/tts";
import type { HskSessionType } from "@/types";

// A-6 듣기 재생 컨트롤 — 속도(0.75/1/1.25)·반복(1/2/무제한)·재생/일시정지·스크립트 토글.
// 음성 소스(추상화): ElevenLabs(서버, 자연스러움) → 미설정/실패 시 브라우저 SpeechSynthesis(zh-CN) 폴백.
//   둘 다 안 되면 대본 표시. 실전(exam)은 1.0x·1회 잠금 + 스크립트 미노출(A-5). a11y: aria-label(A-11).
// ※ 화자별 다른 음성(멀티보이스)은 후속.

const SPEEDS = [0.75, 1, 1.25] as const;
type RepeatCount = 1 | 2 | "inf";
const REPEATS: { value: RepeatCount; label: string }[] = [
  { value: 1, label: "1회" },
  { value: 2, label: "2회" },
  { value: "inf", label: "무제한" },
];

type Backend = "pending" | "elevenlabs" | "browser" | "none";

export default function ListeningPlayer({
  audioScript,
  scriptPinyin,
  scriptTranslation,
  sessionType,
}: {
  audioScript: string;
  scriptPinyin?: string;
  scriptTranslation?: string;
  sessionType?: HskSessionType;
}) {
  const locked = sessionType === "exam";

  const [backend, setBackend] = useState<Backend>("pending");
  const [synth, setSynth] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [repeat, setRepeat] = useState<RepeatCount>(1);
  const [scriptOpen, setScriptOpen] = useState(false);

  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playsLeft = useRef(0);

  // 마운트 시: ElevenLabs 오디오 사전 생성. 실패하면 브라우저 TTS로 폴백(즉시 사용 가능).
  const prepare = useCallback(async () => {
    setSynth(true);
    try {
      const res = await fetch("/api/hsk/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: audioScript }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audio.onended = () => {
          if (playsLeft.current === Infinity || playsLeft.current > 1) {
            if (playsLeft.current !== Infinity) playsLeft.current -= 1;
            audio.currentTime = 0;
            void audio.play();
          } else {
            setPlaying(false);
          }
        };
        audioRef.current = audio;
        setBackend("elevenlabs");
        return;
      }
    } catch {
      /* fall through to browser TTS */
    } finally {
      setSynth(false);
    }
    // ElevenLabs 미설정/실패 → 브라우저 TTS 폴백(없으면 대본).
    setBackend(isSpeechSupported() ? "browser" : "none");
  }, [audioScript]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 음성 소스 준비(로딩 상태). 의도적.
    void prepare();
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current = null;
      urlRef.current = null;
      if (isSpeechSupported()) window.speechSynthesis.cancel();
    };
  }, [prepare]);

  // 브라우저 TTS 재생(반복·속도 반영). 속도 변경은 다음 재생부터 적용.
  const speakBrowser = useCallback(() => {
    const api = window.speechSynthesis;
    api.cancel();
    playsLeft.current = locked ? 1 : repeat === "inf" ? Infinity : repeat;
    const rate = locked ? 1 : speed;
    const speakOnce = () => {
      const u = new SpeechSynthesisUtterance(audioScript);
      u.lang = "zh-CN";
      u.rate = rate;
      u.onend = () => {
        if (playsLeft.current === Infinity || playsLeft.current > 1) {
          if (playsLeft.current !== Infinity) playsLeft.current -= 1;
          speakOnce();
        } else {
          setPlaying(false);
        }
      };
      api.speak(u);
    };
    speakOnce();
    setPlaying(true);
  }, [audioScript, locked, repeat, speed]);

  function togglePlay() {
    if (backend === "elevenlabs") {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) {
        audio.pause();
        setPlaying(false);
        return;
      }
      audio.playbackRate = locked ? 1 : speed;
      playsLeft.current = locked ? 1 : repeat === "inf" ? Infinity : repeat;
      void audio.play();
      setPlaying(true);
      return;
    }
    if (backend === "browser") {
      if (playing) {
        window.speechSynthesis.cancel();
        setPlaying(false);
      } else {
        speakBrowser();
      }
    }
  }

  function applySpeed(s: number) {
    setSpeed(s);
    if (backend === "elevenlabs" && audioRef.current) audioRef.current.playbackRate = s;
  }

  const canPlay = backend === "elevenlabs" || backend === "browser";
  const ctrlBtn =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={synth || !canPlay}
          aria-label={playing ? "일시정지" : "듣기 재생"}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60"
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {synth ? "음성 준비 중…" : playing ? "일시정지" : "듣기"}
        </button>

        {locked ? (
          <span className="text-[11px] font-semibold text-muted">실전: 1.0x · 1회 고정</span>
        ) : (
          canPlay && (
            <>
              <div className="inline-flex items-center gap-1" role="group" aria-label="재생 속도">
                <Gauge size={13} className="text-muted" aria-hidden />
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applySpeed(s)}
                    aria-pressed={speed === s}
                    aria-label={`재생 속도 ${s}배`}
                    className={`${ctrlBtn} ${speed === s ? "bg-blue text-white" : "bg-white text-blue-dark border border-blue/25"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1" role="group" aria-label="반복 횟수">
                <Repeat size={13} className="text-muted" aria-hidden />
                {REPEATS.map((r) => (
                  <button
                    key={String(r.value)}
                    type="button"
                    onClick={() => setRepeat(r.value)}
                    aria-pressed={repeat === r.value}
                    aria-label={`반복 ${r.label}`}
                    className={`${ctrlBtn} ${repeat === r.value ? "bg-blue text-white" : "bg-white text-blue-dark border border-blue/25"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          )
        )}
      </div>

      {backend === "browser" && (
        <p className="text-[11px] text-muted">브라우저 음성으로 재생돼요. 더 자연스러운 음성은 관리자가 ElevenLabs 키를 설정하면 켜집니다.</p>
      )}

      {backend === "none" && (
        <div className="rounded-md border border-gold-soft bg-gold-soft px-3 py-2">
          <p className="text-[11px] font-semibold text-gold-dark">
            이 브라우저는 음성 재생을 지원하지 않아요. 대본으로 대신 볼게요.
          </p>
          <p lang="zh" className="mt-1 whitespace-pre-wrap font-cn text-sm text-ink">{audioScript}</p>
        </div>
      )}

      {/* 스크립트 토글 — 연습 모드에서만(A-6). 실전·대본폴백 상태는 미노출. */}
      {!locked && backend !== "none" && (
        <div>
          <button
            type="button"
            onClick={() => setScriptOpen((o) => !o)}
            aria-expanded={scriptOpen}
            aria-label="대본 원문·병음·번역 보기"
            className={`${ctrlBtn} bg-white text-blue-dark border border-blue/25`}
          >
            <ScrollText size={13} aria-hidden />
            {scriptOpen ? "대본 숨기기" : "대본 보기"}
          </button>
          {scriptOpen && (
            <div className="mt-2 space-y-1.5 rounded-md border border-hairline bg-ivory p-3">
              <p lang="zh" className="whitespace-pre-wrap font-cn text-sm text-ink">{audioScript}</p>
              {scriptPinyin && (
                <p lang="zh" className="font-cn text-xs">
                  {pinyinToneParts(scriptPinyin).map((p, i) => (
                    <span key={i} className={toneTextClass(p.tone)}>
                      {p.text}
                    </span>
                  ))}
                </p>
              )}
              {scriptTranslation && <p className="text-xs text-bodytx">{scriptTranslation}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
