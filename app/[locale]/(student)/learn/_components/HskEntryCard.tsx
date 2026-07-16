"use client";
import { useState } from "react";
import { ArrowRight, Target } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import {
  HSK_AREAS,
  HSK_GRADING_MODES,
  HSK_LEVELS,
  HSK_MODES,
  HSK_SESSION_TYPES,
} from "@/lib/hsk";
import type {
  HskArea,
  HskGradingMode,
  HskLevel,
  HskMode,
  HskSessionType,
} from "@/types";

// 실전 HSK 입장 카드 (docs/dashboard-features.md §1 · A-1/2/3 개편)
// 계층 선택(칩): 급수 → 영역(듣기 신규) → 모드 → (문제풀이 시) 연습/실전 → (연습 시) 채점방식.
// 입장 시 모든 선택값을 /hsk/session 으로 전달(A-4). card-pop hover(D) + a11y(E).
const chip =
  "card-pop rounded-lg py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-1 focus-visible:ring-offset-blue-soft";
const chipOn = "bg-blue text-white";
const chipOff = "bg-white text-blue-dark border border-blue/25 hover:bg-white/70";
const groupLabel = "mb-2 text-[10px] font-bold uppercase tracking-wider text-blue";

export default function HskEntryCard({
  chapterId = 1,
}: {
  chapterId?: number | string;
}) {
  const router = useRouter();
  // 온보딩 목표 급수 프리필 자리 — 데이터 연동 전까지 4급 기본.
  const [level, setLevel] = useState<HskLevel>(4);
  const [area, setArea] = useState<HskArea>("writing"); // 쓰기 = 킬러 영역, 기본 강조
  const [mode, setMode] = useState<HskMode>("practice");
  const [sessionType, setSessionType] = useState<HskSessionType>("drill");
  const [gradingMode, setGradingMode] = useState<HskGradingMode>("immediate");
  // 말하기(곧) 출시 알림 신청 상태.
  const [speakingRequested, setSpeakingRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);

  function enter() {
    const q = new URLSearchParams({
      level: String(level),
      area,
      hskMode: mode,
      chapter: String(chapterId),
    });
    if (mode === "practice") {
      q.set("sessionType", sessionType);
      if (sessionType === "drill") q.set("gradingMode", gradingMode);
    }
    router.push(`/hsk/session?${q.toString()}`);
  }

  // 말하기 영역은 아직 비활성 — 클릭 시 출시 알림 대기자 신청.
  async function requestSpeaking() {
    if (requesting || speakingRequested) return;
    setRequesting(true);
    setSpeakingRequested(true); // 낙관적
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "hsk_speaking" }),
      });
    } catch {
      /* 실패해도 UX 흐름은 유지 */
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="card-pop flex flex-col overflow-hidden rounded-xl2 border border-blue bg-white">
      {/* 헤더 — A-1: "AI 무한생성" 배지 제거 */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Target size={20} className="text-blue" aria-hidden />
        <span className="text-[17px] font-semibold text-blue-dark">실전 HSK</span>
      </div>
      <div className="h-[3px] bg-blue" aria-hidden />

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-4 bg-blue-soft p-4">
        {/* 급수 */}
        <div>
          <div className={groupLabel}>급수</div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="급수 선택">
            {HSK_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                aria-pressed={level === lv}
                className={`${chip} ${level === lv ? chipOn : chipOff}`}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>

        {/* 영역 — 듣기/독해/쓰기/말하기(곧) */}
        <div>
          <div className={groupLabel}>영역</div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="영역 선택">
            {HSK_AREAS.map((a) =>
              a.disabled ? (
                <button
                  key={a.value}
                  type="button"
                  onClick={requestSpeaking}
                  disabled={requesting}
                  aria-pressed={speakingRequested}
                  aria-label={
                    speakingRequested
                      ? "말하기 — 출시 알림 신청 완료"
                      : "말하기 — 곧 출시, 클릭 시 알림 신청"
                  }
                  title={speakingRequested ? "신청 완료" : "출시 알림 신청"}
                  className={`rounded-lg py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 inline-flex items-center justify-center gap-1 border border-dashed border-blue/30 text-muted ${
                    speakingRequested ? "bg-blue-soft" : "bg-white/50 hover:bg-white"
                  }`}
                >
                  {a.label}
                  <span className="rounded-full bg-blue/10 px-1 text-[9px] font-bold text-blue">
                    곧
                  </span>
                </button>
              ) : (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setArea(a.value)}
                  aria-pressed={area === a.value}
                  className={`${chip} ${area === a.value ? chipOn : chipOff}`}
                >
                  {a.label}
                </button>
              ),
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-blue/70">
            {speakingRequested
              ? "✓ 신청 완료! 말하기 출시되면 알려드릴게요"
              : "말하기를 누르면 출시 알림을 신청할 수 있어요"}
          </div>
        </div>

        {/* 모드 — 문제 풀이 / 개념 학습 */}
        <div>
          <div className={groupLabel}>모드</div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="모드 선택">
            {HSK_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
                title={m.desc}
                className={`${chip} ${mode === m.value ? chipOn : chipOff}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 문제 풀이 → 연습/실전 */}
        {mode === "practice" && (
          <div>
            <div className={groupLabel}>연습 · 실전</div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="연습 또는 실전 선택">
              {HSK_SESSION_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSessionType(s.value)}
                  aria-pressed={sessionType === s.value}
                  title={s.desc}
                  className={`${chip} ${sessionType === s.value ? chipOn : chipOff}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 연습 → 채점 방식 (실전은 모아서 강제라 숨김, A-5) */}
        {mode === "practice" && sessionType === "drill" && (
          <div>
            <div className={groupLabel}>채점 방식</div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="채점 방식 선택">
              {HSK_GRADING_MODES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGradingMode(g.value)}
                  aria-pressed={gradingMode === g.value}
                  title={g.desc}
                  className={`${chip} ${gradingMode === g.value ? chipOn : chipOff}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 입장 — A-2: 문구 변경 */}
        <button
          type="button"
          onClick={enter}
          className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-blue bg-gradient-to-b from-white to-blue-soft text-sm font-semibold text-blue transition-transform hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-soft"
        >
          우리 함께 고득점 노려볼까요!
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
