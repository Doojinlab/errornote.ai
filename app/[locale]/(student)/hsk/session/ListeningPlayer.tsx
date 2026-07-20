"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Repeat, Gauge, ScrollText } from "lucide-react";
import { pinyinToneParts, toneTextClass } from "@/lib/pinyin-tone";
import { formatDialogueScript } from "@/lib/hsk-quiz";
import type { HskSessionType } from "@/types";
import type { HskSpeaker } from "@/types/hsk";

// A-6 듣기 재생 컨트롤 — 속도(0.75/1/1.25)·반복(1/2/무제한)·재생/일시정지·스크립트 토글.
// 음성은 ElevenLabs(서버 /api/tts, 기본 v3)로 통일. 마운트 시 사전 생성·캐싱.
// 키 미설정/실패 시 대본 표시로 폴백. 실전(exam)은 1.0x·1회 잠금 + 스크립트 미노출(A-5).

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
  scriptPinyin,
  scriptTranslation,
  sessionType,
  scriptOpen: scriptOpenProp,
  onToggleScript,
  scriptEnabled = true,
  onAudioComplete,
}: {
  audioScript: string;
  /** 실제 합성할 음성 텍스트(대화+질문+보기). 미지정 시 audioScript. 대본 표시는 audioScript 만. */
  speechText?: string;
  cast?: HskSpeaker[];
  scriptPinyin?: string;
  scriptTranslation?: string;
  sessionType?: HskSessionType;
  /** 대본 열림 상태(제어). 미지정 시 내부 상태 사용. */
  scriptOpen?: boolean;
  onToggleScript?: () => void;
  /** 대본 보기 활성 여부(듣기 완료 전 비활성). 기본 true. */
  scriptEnabled?: boolean;
  /** 음성을 끝까지 재생했거나(1회) 음성이 없을 때(폴백) 1회 호출 — 대본·정답 활성화 신호. */
  onAudioComplete?: () => void;
}) {
  const locked = sessionType === "exam";

  const [synth, setSynth] = useState(true);
  const [ttsDown, setTtsDown] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [repeat, setRepeat] = useState<RepeatCount>(1);
  const [scriptOpenLocal, setScriptOpenLocal] = useState(false);
  // 제어 모드(onToggleScript 제공) 우선, 아니면 내부 상태.
  const scriptOpen = scriptOpenProp ?? scriptOpenLocal;
  const toggleScript = () => (onToggleScript ? onToggleScript() : setScriptOpenLocal((o) => !o));

  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playsLeft = useRef(0);
  // 최신 onAudioComplete 를 ref 로 보관 — ensureAudio 의존성에 넣지 않아 매 렌더 재합성을 막는다.
  const onAudioCompleteRef = useRef(onAudioComplete);
  useEffect(() => {
    onAudioCompleteRef.current = onAudioComplete;
  }, [onAudioComplete]);

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
        onAudioCompleteRef.current?.(); // 음성 없음(폴백) — 들을 게 없으니 대본·정답 바로 활성화
        return null;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.onended = () => {
        onAudioCompleteRef.current?.(); // 끝까지 1회 들음 — 대본·정답 활성화
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
      onAudioCompleteRef.current?.(); // 합성 실패(폴백) — 대본·정답 활성화
      return null;
    } finally {
      setSynth(false);
    }
  }, [audioScript, speechText, cast]);

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

      {/* 스크립트 토글 — 연습 모드에서만(A-6). 실전·대본폴백은 미노출.
          듣기를 끝까지 듣기 전(scriptEnabled=false)에는 비활성. */}
      {!locked && !ttsDown && (
        <div>
          <button
            type="button"
            onClick={toggleScript}
            disabled={!scriptEnabled}
            aria-expanded={scriptOpen}
            aria-label="대본 원문·병음·번역 보기"
            title={scriptEnabled ? undefined : "음성을 끝까지 들으면 볼 수 있어요"}
            className={`${ctrlBtn} bg-white text-blue-dark border border-blue/25 disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <ScrollText size={13} aria-hidden />
            {scriptOpen ? "대본 숨기기" : "대본 보기"}
          </button>
          {!scriptEnabled && (
            <span className="ml-2 text-[11px] text-muted">음성을 끝까지 들으면 활성화돼요</span>
          )}
          {scriptOpen && (
            <div className="mt-2 space-y-1.5 rounded-md border border-hairline bg-ivory p-3">
              <p lang="zh" className="whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">{formatDialogueScript(audioScript)}</p>
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
