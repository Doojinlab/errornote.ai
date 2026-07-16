"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flag, ChevronLeft, ChevronRight, RotateCcw, Clock, AlertTriangle, Lightbulb, MessageCircle, Lock } from "lucide-react";
import Card from "@/components/ui/Card";
import TutorChat from "@/components/learn/TutorChat";
import ListeningPlayer from "./ListeningPlayer";
import {
  gradeQuiz,
  isComplete,
  formatElapsed,
  formatDialogueScript,
  type QuizItem,
} from "@/lib/hsk-quiz";
import type { HskGradingMode, HskSessionType } from "@/types";

// A-γ 다문항 세션 + A-δ 실전 모드.
// A-10 문항 네비/플래그 · A-7 채점 타이밍 · A-8 성적표+오답 적립 ·
// A-5 실전 타이머·자동제출 · A-9 이탈 정책(실전 경고 / 연습 이어풀기).

const SECONDS_PER_ITEM: Record<QuizItem["kind"], number> = {
  listening: 45,
  reading: 40,
};
const WARN_SECONDS = 15;

interface Persisted {
  items: QuizItem[];
  answers: Record<number, string>;
  index: number;
  flagged: number[];
}

export default function QuizSession({
  items,
  gradingMode,
  sessionType,
  topic,
  storageKey,
  initialState,
  onRetry,
}: {
  items: QuizItem[];
  gradingMode: HskGradingMode;
  sessionType?: HskSessionType;
  /** 오답 적립 topic (예: "HSK 4급 듣기"). */
  topic: string;
  /** 연습(drill) 이어풀기 저장 키. 실전/미제공이면 null. */
  storageKey?: string | null;
  initialState?: { answers: Record<number, string>; index: number; flagged: number[] };
  onRetry: () => void;
}) {
  const isExam = sessionType === "exam";

  const [index, setIndex] = useState(initialState?.index ?? 0);
  const [answers, setAnswers] = useState<Record<number, string>>(initialState?.answers ?? {});
  const [flagged, setFlagged] = useState<Set<number>>(new Set(initialState?.flagged ?? []));
  const [submitted, setSubmitted] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const budget = useMemo(
    () => items.reduce((s, it) => s + SECONDS_PER_ITEM[it.kind], 0),
    [items],
  );
  const [timeLeft, setTimeLeft] = useState(budget);

  const immediate = gradingMode === "immediate";
  const complete = isComplete(items, answers);
  const answeredCount = Object.keys(answers).length;
  const result = useMemo(
    () => (submitted ? gradeQuiz(items, answers) : null),
    [submitted, items, answers],
  );

  // 오답 적립(A-8) — 응답했는데 틀린 문항을 /api/quiz-mistakes 로 스냅샷 저장(비치명적).
  const accrue = useCallback(() => {
    for (const [k, chosen] of Object.entries(answers)) {
      const i = Number(k);
      const it = items[i];
      if (!it || chosen === it.answer) continue;
      const chosenIndex = it.options.indexOf(chosen);
      const answerIndex = it.options.indexOf(it.answer);
      if (chosenIndex < 0 || answerIndex < 0) continue;
      void fetch("/api/quiz-mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          prompt: it.question,
          options: it.options,
          chosenIndex,
          answerIndex,
          explanation: it.explanation || null,
        }),
      }).catch(() => {});
    }
  }, [answers, items, topic]);

  const submit = useCallback(() => {
    setElapsed(Date.now() - startedAt);
    setSubmitted(true);
    accrue();
    if (storageKey && typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  }, [accrue, startedAt, storageKey]);

  // 실전 타이머(A-5) — 0 이면 자동 제출.
  useEffect(() => {
    if (!isExam || submitted) return;
    if (timeLeft <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 제한시간 초과 시 자동 제출(A-5). 의도적 종료 동작.
      submit();
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [isExam, submitted, timeLeft, submit]);

  // 연습 이어풀기(A-9) — 진행 상태 저장. 실전은 저장 안 함(중단=무효).
  useEffect(() => {
    if (!storageKey || submitted || typeof window === "undefined") return;
    const blob: Persisted = { items, answers, index, flagged: [...flagged] };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(blob));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [storageKey, submitted, items, answers, index, flagged]);

  // 실전 이탈 경고(A-9) — 새로고침/닫기 시 확인.
  useEffect(() => {
    if (!isExam || submitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isExam, submitted]);

  function select(opt: string) {
    if (immediate && answers[index] !== undefined) return;
    setAnswers((a) => ({ ...a, [index]: opt }));
  }
  function toggleFlag() {
    setFlagged((f) => {
      const n = new Set(f);
      if (n.has(index)) n.delete(index);
      else n.add(index);
      return n;
    });
  }
  function retry() {
    if (storageKey && typeof window !== "undefined") window.localStorage.removeItem(storageKey);
    onRetry();
  }

  if (submitted && result) {
    return <ResultsView items={items} answers={answers} result={result} elapsed={elapsed} onRetry={retry} />;
  }

  const item = items[index];
  const answered = answers[index] !== undefined;
  // 실전은 채점 전 정답/해설을 절대 노출하지 않는다(시험 무결성). 연습·즉시채점 + 응답 시에만 공개.
  const revealed = !isExam && immediate && answered;

  return (
    // 좌: 문제 풀이 / 우: 해설·AI 과외(errornote 공통 — 모든 콘텐츠 우측에 해설·AI). 모바일은 아래로 스택.
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-4">
      <div className="space-y-3">
        {/* 실전: 타이머 + 이탈 경고 */}
        {isExam && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-muted">
                <AlertTriangle size={12} className="text-terra" aria-hidden />
                실전 — 나가면 무효(결과 미기록)
              </span>
              <span
                className={`inline-flex items-center gap-1 font-bold tabular-nums ${
                  timeLeft <= WARN_SECONDS ? "text-terra" : "text-blue-dark"
                }`}
                aria-live="polite"
              >
                <Clock size={13} aria-hidden />
                {formatClock(timeLeft)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden>
              <div
                className={`h-full transition-[width] duration-1000 ${timeLeft <= WARN_SECONDS ? "bg-terra" : "bg-blue"}`}
                style={{ width: `${budget > 0 ? (timeLeft / budget) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* 진행 + 플래그 */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={toggleFlag}
            aria-pressed={flagged.has(index)}
            aria-label={flagged.has(index) ? "표시 해제" : "나중에 다시 볼 문항으로 표시"}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
              flagged.has(index) ? "bg-gold-soft text-gold-dark" : "border border-hairline bg-white text-muted hover:bg-ivory"
            }`}
          >
            <Flag size={13} aria-hidden />
            표시
          </button>
        </div>

        <Card className="space-y-3 p-4">
          <p className="text-sm text-bodytx">{item.instructions}</p>
          {item.kind === "listening" && item.audioScript && (
            <ListeningPlayer
              audioScript={item.audioScript}
              scriptPinyin={item.scriptPinyin}
              scriptTranslation={item.scriptTranslation}
              sessionType={sessionType}
            />
          )}
          {item.passage && (
            <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] leading-relaxed text-ink">
              {formatDialogueScript(item.passage)}
            </p>
          )}
          {/* 질문·보기는 실제 HSK 처럼 중국어 */}
          <p lang="zh" className="font-cn text-base font-semibold leading-relaxed text-ink">{item.question}</p>
          <Choices
            options={item.options}
            answer={item.answer}
            selected={answers[index] ?? null}
            onSelect={select}
            reveal={revealed}
            locked={revealed}
          />
        </Card>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="이전 문항"
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-bodytx disabled:opacity-40"
          >
            <ChevronLeft size={14} aria-hidden /> 이전
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={index === items.length - 1}
            aria-label="다음 문항"
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-bodytx disabled:opacity-40"
          >
            다음 <ChevronRight size={14} aria-hidden />
          </button>
        </div>

        {/* 문항 네비 그리드(A-10) */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-muted">
            문항 이동 · 안 푼 문항 {items.length - answeredCount}개
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="문항 이동">
            {items.map((_, i) => {
              const isCur = i === index;
              const isAns = answers[i] !== undefined;
              const isFlag = flagged.has(i);
              let cls = "border-hairline bg-white text-muted";
              if (isAns) cls = "border-jade bg-jade-soft text-jade-dark";
              if (isFlag) cls = "border-gold bg-gold-soft text-gold-dark";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}번 문항${isAns ? " (완료)" : ""}${isFlag ? " (표시됨)" : ""}`}
                  aria-current={isCur ? "true" : undefined}
                  className={`relative h-8 w-8 rounded-md border text-xs font-bold transition-colors ${cls} ${isCur ? "ring-2 ring-blue ring-offset-1" : ""}`}
                >
                  {i + 1}
                  {isFlag && <Flag size={9} className="absolute -right-0.5 -top-0.5 text-gold-dark" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 채점 */}
        {immediate ? (
          complete && (
            <button type="button" onClick={submit} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue text-sm font-bold text-white">
              성적표 보기
            </button>
          )
        ) : (
          <button type="button" onClick={submit} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue text-sm font-bold text-white">
            제출하고 채점 {!complete && `(안 푼 ${items.length - answeredCount}개는 오답 처리)`}
          </button>
        )}
      </div>

      {/* 우: 해설 + AI 과외 (상시 노출). 실전은 잠금. */}
      <SidePanel item={item} revealed={revealed} isExam={isExam} immediate={immediate} />
    </div>
  );
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function ResultsView({
  items,
  answers,
  result,
  elapsed,
  onRetry,
}: {
  items: QuizItem[];
  answers: Record<number, string>;
  result: ReturnType<typeof gradeQuiz>;
  elapsed: number;
  onRetry: () => void;
}) {
  const band = result.score >= 80 ? "jade" : result.score >= 60 ? "gold" : "terra";
  const bandCls =
    band === "jade"
      ? "border-jade-soft bg-jade-soft text-jade"
      : band === "gold"
        ? "border-gold-soft bg-gold-soft text-gold"
        : "border-terra-soft bg-terra-soft text-terra";

  return (
    <div className="space-y-3">
      <Card className={`border ${bandCls} p-5 text-center`}>
        <p className="text-sm text-bodytx">성적표</p>
        <p className="mt-1 text-4xl font-extrabold">{result.score}점</p>
        <p className="mt-1 text-xs text-bodytx">
          {result.correct} / {result.total} 정답 · 소요시간 {formatElapsed(elapsed)}
        </p>
      </Card>

      {result.wrongIndexes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">틀린 문항 리뷰 ({result.wrongIndexes.length})</h3>
            <span className="text-[11px] text-muted">오답은 「오답 노트」에 자동 저장됨</span>
          </div>
          {result.wrongIndexes.map((i) => {
            const it = items[i];
            return (
              <Card key={i} className="space-y-1.5 p-3">
                <p className="text-xs font-semibold text-muted">{i + 1}번</p>
                <p className="text-sm font-semibold text-ink">{it.question}</p>
                <p className="text-xs text-terra-dark">
                  내 답: {answers[i] ? <span lang="zh" className="font-cn">{answers[i]}</span> : "미응답"}
                </p>
                <p className="text-xs text-jade-dark">
                  정답: <span lang="zh" className="font-cn font-semibold">{it.answer}</span>
                </p>
                {it.explanation && <p className="text-xs text-bodytx">{it.explanation}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-soft px-3 py-2 text-xs font-bold text-blue-dark"
      >
        <RotateCcw size={14} aria-hidden />
        새 문제로 재도전
      </button>
    </div>
  );
}

function Choices({
  options,
  answer,
  selected,
  onSelect,
  reveal,
  locked,
}: {
  options: string[];
  answer: string;
  selected: string | null;
  onSelect: (v: string) => void;
  reveal: boolean;
  locked: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isAnswer = opt === answer;
        const isPicked = opt === selected;
        let cls = "border-hairline bg-white text-bodytx";
        if (reveal && isAnswer) cls = "border-jade bg-jade-soft text-jade-dark";
        else if (reveal && isPicked) cls = "border-terra bg-terra-soft text-terra-dark";
        else if (!reveal && isPicked) cls = "border-blue bg-blue-soft text-blue-dark";
        return (
          <button
            key={opt}
            type="button"
            disabled={locked}
            onClick={() => onSelect(opt)}
            lang="zh"
            className={`block w-full rounded-lg border px-3 py-2 text-left font-cn text-sm transition-colors ${cls}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// 우측 상시 패널 — [해설 | AI 과외]. 실전(exam)은 채점 전 잠금(시험 무결성).
// errornote 공통 규칙: 모든 콘텐츠 우측에 해설창 + AI 질문창이 존재.
function SidePanel({
  item,
  revealed,
  isExam,
  immediate,
}: {
  item: QuizItem;
  revealed: boolean;
  isExam: boolean;
  immediate: boolean;
}) {
  const [tab, setTab] = useState<"explain" | "chat">("explain");
  const tabBtn = (on: boolean) =>
    `flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${
      on ? "bg-blue-soft text-blue-dark" : "text-bodytx hover:bg-ivory"
    }`;

  return (
    <div className="mt-3 flex h-[300px] flex-col overflow-hidden rounded-xl2 border border-hairline bg-white lg:mt-0 lg:sticky lg:top-4 lg:h-[560px]">
      <div className="grid grid-cols-2 border-b border-hairline" role="tablist" aria-label="해설·AI 과외">
        <button type="button" role="tab" aria-selected={tab === "explain"} onClick={() => setTab("explain")} className={tabBtn(tab === "explain")}>
          <Lightbulb size={15} aria-hidden /> 해설
        </button>
        <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")} className={tabBtn(tab === "chat")}>
          <MessageCircle size={15} aria-hidden /> AI 과외
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "explain" ? (
          <ExplainBody item={item} revealed={revealed} isExam={isExam} immediate={immediate} />
        ) : isExam ? (
          <LockedNote text="실전 중에는 AI 과외를 쓸 수 없어요. 채점이 끝나면 물어볼 수 있어요." />
        ) : (
          <TutorChat focusedError={null} />
        )}
      </div>
    </div>
  );
}

function ExplainBody({
  item,
  revealed,
  isExam,
  immediate,
}: {
  item: QuizItem;
  revealed: boolean;
  isExam: boolean;
  immediate: boolean;
}) {
  if (!revealed) {
    const msg = isExam
      ? "실전 채점 후 성적표에서 해설을 확인할 수 있어요."
      : immediate
        ? "답을 고르면 여기에 정답·해설이 나와요."
        : "모아서 채점을 제출하면 성적표에서 해설이 나와요.";
    return (
      <div className="flex h-full items-center justify-center p-5 text-center">
        <p className="text-sm text-muted">{msg}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-bodytx">
        정답: <span lang="zh" className="font-cn font-semibold text-jade-dark">{item.answer}</span>
      </p>
      {item.audioScript && (
        <div>
          <p className="text-[11px] font-semibold text-muted">대본</p>
          <p lang="zh" className="mt-0.5 whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">
            {formatDialogueScript(item.audioScript)}
          </p>
        </div>
      )}
      {item.explanation && (
        <div>
          <p className="text-[11px] font-semibold text-muted">해설</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-bodytx">{item.explanation}</p>
        </div>
      )}
    </div>
  );
}

function LockedNote({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
      <Lock size={18} className="text-muted" aria-hidden />
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
