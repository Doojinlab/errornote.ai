"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Clock, AlertTriangle, Lightbulb, MessageCircle, Lock, Eye, Check, X } from "lucide-react";
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

// 듣기 음성 텍스트 — 대화(대본)에 이어 질문·보기까지 읽어준다(실제 HSK 처럼). 화면에서 문제 텍스트를
// 숨겨도 음성만으로 무엇을 묻는지·보기가 무엇인지 알 수 있게. (한글·라틴은 서버 TTS 가 걸러 중국어만 읽음)
function buildListeningSpeech(it: QuizItem): string {
  const parts: string[] = [];
  if (it.audioScript) parts.push(it.audioScript);
  if (it.question) parts.push(it.question);
  if (it.options.length) parts.push(it.options.join("。"));
  return parts.join("\n");
}

interface Persisted {
  items: QuizItem[];
  answers: Record<number, string>;
  index: number;
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
  initialState?: { answers: Record<number, string>; index: number };
  onRetry: () => void;
}) {
  const isExam = sessionType === "exam";

  const [index, setIndex] = useState(initialState?.index ?? 0);
  const [answers, setAnswers] = useState<Record<number, string>>(initialState?.answers ?? {});
  // 해설은 정답을 고른 뒤 "해설 보기"를 눌러야 열린다(자동 노출 X). 문항별.
  const [explainOpenSet, setExplainOpenSet] = useState<Set<number>>(new Set());
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
    const blob: Persisted = { items, answers, index };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(blob));
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [storageKey, submitted, items, answers, index]);

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
  function retry() {
    if (storageKey && typeof window !== "undefined") window.localStorage.removeItem(storageKey);
    onRetry();
  }

  if (submitted && result) {
    return <ResultsView items={items} answers={answers} result={result} elapsed={elapsed} onRetry={retry} />;
  }

  const item = items[index];
  const answered = answers[index] !== undefined;
  // 듣기 연습: 문제 텍스트는 좌측에 숨기고(음성이 읽어줌) 해설로 통합한다. 독해는 그대로 노출.
  const gateListening = !isExam && item.kind === "listening";

  // 보기 채점(정답/오답 하이라이트)은 정답을 고르면 즉시(실전은 채점 전 미노출).
  const choiceRevealed = !isExam && immediate && answered;
  // 해설(문제·대본·해석·해설)은 자동 노출 X — 정답을 고른 뒤 "해설 보기"를 눌러야 열린다.
  const canOpenExplain = !isExam && immediate && answered;
  const explainOpen = explainOpenSet.has(index);

  function openExplain() {
    setExplainOpenSet((s) => (s.has(index) ? s : new Set(s).add(index)));
  }

  return (
    // 3단(데스크톱): 좌=문제 / 가운데=해설 / 우=AI 과외. 탭 없이 각 열로 세로로 길게(화면 폭 활용).
    // 모바일은 아래로 스택. errornote 공통 — 모든 콘텐츠에 해설·AI 상시 노출.
    <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
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

        {/* 진행 — 상단 "표시"(플래그)·"정답표시"는 삭제. 해설은 해설 창의 "해설 보기"로 연다. */}
        <div className="flex items-center">
          <span className="text-xs font-semibold text-muted">
            {index + 1} / {items.length}
          </span>
        </div>

        <Card className="space-y-3 p-4">
          <p className="text-sm text-bodytx">{item.instructions}</p>
          {item.kind === "listening" && item.audioScript && (
            <ListeningPlayer
              audioScript={item.audioScript}
              speechText={buildListeningSpeech(item)}
              cast={item.cast}
              sessionType={sessionType}
            />
          )}
          {item.passage && (
            <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] leading-relaxed text-ink">
              {formatDialogueScript(item.passage)}
            </p>
          )}
          {/* 듣기 연습: 문제(질문) 텍스트는 좌측에 숨긴다 — 음성이 질문·보기를 읽어주고,
              문제·대본·해석·해설은 정답을 고른 뒤 해설 창의 「해설 보기」에서 통합해 본다.
              독해는 문제를 그대로 노출. 보기(선택지)는 항상 노출·선택 가능. */}
          {gateListening ? (
            <p className="rounded-md border border-hairline bg-ivory px-3 py-2.5 text-xs leading-relaxed text-muted">
              음성을 듣고 아래 보기에서 정답을 골라 보세요. 문제·대본·해석·해설은 정답을 고른 뒤
              해설 창의 「해설 보기」에서 볼 수 있어요.
            </p>
          ) : (
            /* 독해 질문은 실제 HSK 처럼 중국어 */
            <p lang="zh" className="font-cn text-base font-semibold leading-relaxed text-ink">{item.question}</p>
          )}
          {/* 보기(선택지)는 듣기여도 항상 노출·선택 가능 — 정답을 고를 수 있어야 한다. */}
          <Choices
            options={item.options}
            answer={item.answer}
            selected={answers[index] ?? null}
            onSelect={select}
            reveal={choiceRevealed}
            locked={choiceRevealed}
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
              let cls = "border-hairline bg-white text-muted";
              if (isAns) cls = "border-jade bg-jade-soft text-jade-dark";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}번 문항${isAns ? " (완료)" : ""}`}
                  aria-current={isCur ? "true" : undefined}
                  className={`relative h-8 w-8 rounded-md border text-xs font-bold transition-colors ${cls} ${isCur ? "ring-2 ring-blue ring-offset-1" : ""}`}
                >
                  {i + 1}
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

      {/* 가운데: 해설 (실전은 채점 후) */}
      <ExplainColumn
        item={item}
        open={explainOpen}
        canOpen={canOpenExplain}
        onOpen={openExplain}
        isExam={isExam}
        immediate={immediate}
      />

      {/* 우: AI 과외 (실전은 잠금) */}
      <ChatColumn isExam={isExam} />
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

  // 상단은 문항별 정답/오답만. 번호를 누르면 아래에 그 문항의 지문·문제·해설·AI 과외를 편다.
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <Card className={`border ${bandCls} p-5 text-center`}>
        <p className="text-sm text-bodytx">성적표</p>
        <p className="mt-1 text-4xl font-extrabold">{result.score}점</p>
        <p className="mt-1 text-xs text-bodytx">
          {result.correct} / {result.total} 정답 · 소요시간 {formatElapsed(elapsed)}
        </p>
      </Card>

      {/* 문항별 정답/오답 요약 — 번호 클릭 시 아래에 지문·해설·AI 과외 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <h3 className="text-sm font-bold text-ink">문항별 결과</h3>
          <span className="text-[11px] text-muted">번호를 누르면 지문·해설·AI 과외가 나와요 · 오답은 「오답 노트」에 자동 저장</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="문항 결과">
          {items.map((it, i) => {
            const correct = answers[i] === it.answer;
            const isCur = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={isCur}
                aria-label={`${i + 1}번 ${correct ? "정답" : "오답"} — 지문·해설 보기`}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 ${
                  correct
                    ? "border-jade bg-jade-soft text-jade-dark"
                    : "border-terra bg-terra-soft text-terra-dark"
                } ${isCur ? "ring-2 ring-blue ring-offset-1" : ""}`}
              >
                {i + 1}
                {correct ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택 문항 상세 — 지문 · 문제 · 내답/정답 · 해설 · AI 채팅(맞은 문제도 노출) */}
      {selected !== null ? (
        <ResultDetail
          key={selected}
          item={items[selected]}
          userAnswer={answers[selected] ?? null}
          index={selected}
        />
      ) : (
        <p className="rounded-xl2 border border-dashed border-hairline bg-white px-4 py-8 text-center text-sm text-muted">
          위 문항 번호를 누르면 지문·해설·AI 과외가 여기에 나와요.
        </p>
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

// 채점 결과의 문항 상세 — 지문(독해)·대본/해석(듣기) + 문제 + 보기(정답 표시) + 해설 + AI 과외.
// 맞은 문제·틀린 문제 모두 동일하게 보여준다(사용자 요청). key=index 로 문항 전환 시 AI 채팅 초기화.
function ResultDetail({
  item,
  userAnswer,
  index,
}: {
  item: QuizItem;
  userAnswer: string | null;
  index: number;
}) {
  const correct = userAnswer !== null && userAnswer === item.answer;
  return (
    <div className="lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:gap-3">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink">{index + 1}번</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              correct ? "bg-jade-soft text-jade-dark" : "bg-terra-soft text-terra-dark"
            }`}
          >
            {correct ? "정답" : "오답"}
          </span>
        </div>

        {/* 지문(독해) / 대본·해석(듣기) */}
        {item.passage && (
          <div>
            <p className="text-[11px] font-semibold text-muted">지문</p>
            <p lang="zh" className="mt-0.5 whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">
              {formatDialogueScript(item.passage)}
            </p>
          </div>
        )}
        {item.audioScript && (
          <div>
            <p className="text-[11px] font-semibold text-muted">대본(지문)</p>
            <p lang="zh" className="mt-0.5 whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">
              {formatDialogueScript(item.audioScript)}
            </p>
          </div>
        )}
        {item.scriptTranslation && (
          <div>
            <p className="text-[11px] font-semibold text-muted">해석</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-bodytx">{item.scriptTranslation}</p>
          </div>
        )}

        {/* 문제(+번역) */}
        <div>
          <p className="text-[11px] font-semibold text-muted">문제</p>
          <p lang="zh" className="mt-0.5 font-cn text-sm font-semibold leading-relaxed text-ink">
            {item.question}
          </p>
          {item.questionTranslation && (
            <p className="mt-0.5 text-sm text-bodytx">{item.questionTranslation}</p>
          )}
        </div>

        {/* 보기 — 정답(초록)·내 답(빨강) 표시 */}
        <Choices options={item.options} answer={item.answer} selected={userAnswer} onSelect={() => {}} reveal locked />

        <div className="space-y-0.5">
          <p className="text-xs text-terra-dark">
            내 답: {userAnswer ? <span lang="zh" className="font-cn">{userAnswer}</span> : "미응답"}
          </p>
          <p className="text-xs text-jade-dark">
            정답: <span lang="zh" className="font-cn font-semibold">{item.answer}</span>
          </p>
        </div>

        {/* 해설 — 맞은 문제도 노출 */}
        {item.explanation && (
          <div>
            <p className="text-[11px] font-semibold text-muted">해설</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-bodytx">{item.explanation}</p>
          </div>
        )}
      </Card>

      {/* AI 과외 채팅 — 문항별(전환 시 초기화). TutorChat 자체 헤더 사용. */}
      <div className="mt-3 flex h-[440px] flex-col overflow-hidden rounded-xl2 border border-hairline bg-white lg:mt-0">
        <TutorChat focusedError={null} />
      </div>
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

// 가운데 열 — 해설(정답·대본·번역·해설). 실전은 채점 전 잠금. 세로로 길게(데스크톱).
// errornote 공통 규칙: 모든 콘텐츠에 해설창 + AI 질문창 상시 노출.
function ExplainColumn({
  item,
  open,
  canOpen,
  onOpen,
  isExam,
  immediate,
}: {
  item: QuizItem;
  open: boolean;
  canOpen: boolean;
  onOpen: () => void;
  isExam: boolean;
  immediate: boolean;
}) {
  return (
    <div className="mt-3 flex flex-col overflow-hidden rounded-xl2 border border-hairline bg-white lg:mt-0 lg:sticky lg:top-4 lg:h-[min(540px,calc(100dvh-10.5rem))]">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Lightbulb size={15} className="text-gold" aria-hidden /> 해설
        </span>
        {/* 해설 보기 — 자동 노출 대신 눌러서 연다. 정답을 골라야 활성화(연습·즉시채점). */}
        {!isExam && immediate && !open && (
          <button
            type="button"
            onClick={onOpen}
            disabled={!canOpen}
            aria-label="해설 보기"
            title={canOpen ? "해설 보기" : "정답을 고르면 볼 수 있어요"}
            className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-white px-2.5 py-1 text-xs font-semibold text-gold-dark transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <Eye size={13} aria-hidden />
            해설 보기
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ExplainBody item={item} open={open} canOpen={canOpen} isExam={isExam} immediate={immediate} />
      </div>
    </div>
  );
}

// 우측 열 — AI 과외 채팅(TutorChat 자체 헤더 사용). 실전은 잠금.
function ChatColumn({ isExam }: { isExam: boolean }) {
  return (
    <div className="mt-3 flex h-[440px] flex-col overflow-hidden rounded-xl2 border border-hairline bg-white lg:mt-0 lg:sticky lg:top-4 lg:h-[min(540px,calc(100dvh-10.5rem))]">
      {isExam ? (
        <>
          <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-3 text-sm font-bold text-ink">
            <MessageCircle size={15} className="text-blue" aria-hidden /> AI 과외
          </div>
          <div className="min-h-0 flex-1">
            <LockedNote text="실전 중에는 AI 과외를 쓸 수 없어요. 채점이 끝나면 물어볼 수 있어요." />
          </div>
        </>
      ) : (
        <TutorChat focusedError={null} />
      )}
    </div>
  );
}

function ExplainBody({
  item,
  open,
  canOpen,
  isExam,
  immediate,
}: {
  item: QuizItem;
  open: boolean;
  canOpen: boolean;
  isExam: boolean;
  immediate: boolean;
}) {
  if (!open) {
    const msg = isExam
      ? "실전 채점 후 성적표에서 해설을 확인할 수 있어요."
      : immediate
        ? canOpen
          ? "위 「해설 보기」를 누르면 정답·대본·해석·해설이 나와요."
          : "정답을 고른 뒤 「해설 보기」를 누르면 정답·대본·해석·해설이 나와요."
        : "모아서 채점을 제출하면 성적표에서 해설이 나와요.";
    return (
      <div className="flex h-full items-center justify-center p-5 text-center">
        <p className="text-sm text-muted">{msg}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      {/* 문제(질문) — 좌측에서 숨겼으므로 해설에 통합. 있으면 한국어 번역도 함께. */}
      {item.question && (
        <div>
          <p className="text-[11px] font-semibold text-muted">문제</p>
          <p lang="zh" className="mt-0.5 font-cn text-sm font-semibold leading-relaxed text-ink">
            {item.question}
          </p>
          {item.questionTranslation && (
            <p className="mt-0.5 text-sm text-bodytx">{item.questionTranslation}</p>
          )}
        </div>
      )}
      <p className="text-xs text-bodytx">
        정답: <span lang="zh" className="font-cn font-semibold text-jade-dark">{item.answer}</span>
      </p>
      {item.audioScript && (
        <div>
          <p className="text-[11px] font-semibold text-muted">대본(지문)</p>
          <p lang="zh" className="mt-0.5 whitespace-pre-wrap font-cn text-sm leading-relaxed text-ink">
            {formatDialogueScript(item.audioScript)}
          </p>
        </div>
      )}
      {/* 중국어 지문과 함께 한국어 해석 제공(사용자 요청) */}
      {item.scriptTranslation && (
        <div>
          <p className="text-[11px] font-semibold text-muted">해석</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-bodytx">{item.scriptTranslation}</p>
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
