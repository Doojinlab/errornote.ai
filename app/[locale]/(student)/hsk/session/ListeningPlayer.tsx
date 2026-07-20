"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Repeat, Gauge } from "lucide-react";
import { formatDialogueScript } from "@/lib/hsk-quiz";
import type { HskSessionType } from "@/types";
import type { HskSpeaker } from "@/types/hsk";

// A-6 듣기 재생 컨트롤 — 속도(0.75/1/1.25)·반복(1/2/무제한)·재생/일시정지.
// 음성은 ElevenLabs(서버 /api/tts)로 통일. 마운트 시 사전 생성·캐싱.
// 키 미설정/실패 시 대본 표시로 폴백. 실전(exam)은 1.0x·1회 잠금(A-5).
// 대본·문제·해석·해설은 해설 창의 "해설 보기"로 통합해 본다(별도 "대본 보기" 없음).

const SPEEDS = [0.75, 1, 1.25] as const;
type RepeatCount = 1 | 2 | "inf";
const REPEATS: { value: RepeatCount; label: string }[] = [
  { value: 1, label: "1회" },
  { value: 2, label: "2회" },
  { value: "inf", label: "무제한" },
];

export default function ListeningPlayer({
  audioScript,
  speechText,
  cast,
  sessionType,
}: {
  audioScript: string;
  /** 실제 합성할 음성 텍스트(대화+질문+보기). 미지정 시 audioScript. */
  speechText?: string;
  cast?: HskSpeaker[];
  sessionType?: HskSessionType;
}) {
  const locked = sessionType === "exam";

  const [synth, setSynth] = useState(true);
  const [ttsDown, setTtsDown] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [repeat, setRepeat] = useState<RepeatCount>(1);

  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playsLeft = useRef(0);

  // ElevenLabs 오디오 사전 생성·캐싱. 실패(503 등) 시 대본 폴백.
  const ensureAudio = useCallback(async (): Promise<HTMLAudioElement | null> => {
    if (audioRef.current) return audioRef.current;
    setSynth(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speechText ?? audioScript, cast }),
      });
      if (!res.ok) {
        setTtsDown(true);
        return null;
      }
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
      return audio;
    } catch {
      setTtsDown(true);
      return null;
    } finally {
      setSynth(false);
    }
  }, [audioScript, speechText, cast]);

  // 마운트 시 미리 생성·캐싱해 "듣기"를 누르면 즉시 재생되게 한다. 멀티보이스는 합성이 2~4초 걸려
  // 클릭 후 생성하면 대기가 길어 이탈 위험 → 미리 생성. 실사용은 문항마다 재생하므로 추가 비용도 미미.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 오디오 사전 생성(로딩 상태). 의도적.
    void ensureAudio();
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current = null;
      urlRef.current = null;
    };
  }, [ensureAudio]);

  async function togglePlay() {
    const audio = await ensureAudio();
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio.playbackRate = locked ? 1 : speed;
    playsLeft.current = locked ? 1 : repeat === "inf" ? Infinity : repeat;
    if (audio.currentTime === 0 || audio.ended) audio.currentTime = 0;
    void audio.play();
    setPlaying(true);
  }

  function applySpeed(s: number) {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }

  const ctrlBtn =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={synth || ttsDown}
          aria-label={playing ? "일시정지" : "듣기 재생"}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60"
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {synth ? "음성 준비 중…" : playing ? "일시정지" : "듣기"}
        </button>

        {locked ? (
          <span className="text-[11px] font-semibold text-muted">실전: 1.0x · 1회 고정</span>
        ) : (
          !ttsDown && (
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

      {ttsDown && (
        <div className="rounded-md border border-gold-soft bg-gold-soft px-3 py-2">
          <p className="text-[11px] font-semibold text-gold-dark">
            음성이 아직 설정되지 않았어요(관리자: ELEVENLABS_API_KEY). 대본으로 대신 볼게요.
          </p>
          <p lang="zh" className="mt-1 whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">{formatDialogueScript(audioScript)}</p>
        </div>
      )}
    </div>
  );
}
