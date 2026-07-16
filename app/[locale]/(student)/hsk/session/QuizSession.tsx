"use client";

import { useMemo, useState } from "react";
import { Flag, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import ListeningPlayer from "./ListeningPlayer";
import {
  gradeQuiz,
  isComplete,
  formatElapsed,
  type QuizItem,
} from "@/lib/hsk-quiz";
import type { HskGradingMode, HskSessionType } from "@/types";

// A-γ 다문항 세션 — 문항 네비/플래그(A-10) + 채점 타이밍(A-7) + 성적표(A-8).
// 실전 타이머·자동제출·오류 적립·이탈 정책은 A-δ.

export default function QuizSession({
  items,
  gradingMode,
  sessionType,
  onRetry,
}: {
  items: QuizItem[];
  gradingMode: HskGradingMode;
  sessionType?: HskSessionType;
  onRetry: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const immediate = gradingMode === "immediate";
  const complete = isComplete(items, answers);
  const answeredCount = Object.keys(answers).length;

  const result = useMemo(
    () => (submitted ? gradeQuiz(items, answers) : null),
    [submitted, items, answers],
  );

  function select(opt: string) {
    // 즉시 채점: 한 번 답하면 그 문항은 고정. 모아서: 제출 전까지 변경 가능.
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

  function submit() {
    setElapsed(Date.now() - startedAt);
    setSubmitted(true);
  }

  if (submitted && result) {
    return (
      <ResultsView
        items={items}
        answers={answers}
        result={result}
        elapsed={elapsed}
        onRetry={onRetry}
      />
    );
  }

  const item = items[index];
  const answered = answers[index] !== undefined;
  const revealed = immediate && answered;

  return (
    <div className="space-y-3">
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
            flagged.has(index)
              ? "bg-gold-soft text-gold-dark"
              : "border border-hairline bg-white text-muted hover:bg-ivory"
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
            {item.passage}
          </p>
        )}
        <p className="text-sm font-semibold text-ink">{item.question}</p>
        <Choices
          options={item.options}
          answer={item.answer}
          selected={answers[index] ?? null}
          onSelect={select}
          reveal={revealed}
          locked={revealed}
        />
        {revealed && (
          <Explain answer={item.answer} explanation={item.explanation} script={item.audioScript} />
        )}
      </Card>

      {/* 이전/다음 */}
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
                className={`relative h-8 w-8 rounded-md border text-xs font-bold transition-colors ${cls} ${
                  isCur ? "ring-2 ring-blue ring-offset-1" : ""
                }`}
              >
                {i + 1}
                {isFlag && <Flag size={9} className="absolute -right-0.5 -top-0.5 text-gold-dark" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 채점 — 즉시: 다 풀면 성적표 / 모아서: 제출 버튼 */}
      {immediate ? (
        complete && (
          <button
            type="button"
            onClick={submit}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue text-sm font-bold text-white"
          >
            성적표 보기
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={submit}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue text-sm font-bold text-white"
        >
          제출하고 채점 {!complete && `(안 푼 ${items.length - answeredCount}개는 오답 처리)`}
        </button>
      )}
    </div>
  );
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
          <h3 className="text-sm font-bold text-ink">틀린 문항 리뷰 ({result.wrongIndexes.length})</h3>
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

function Explain({
  answer,
  explanation,
  script,
}: {
  answer: string;
  explanation: string;
  script?: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-hairline bg-ivory p-3">
      <p className="text-xs text-bodytx">
        정답: <span lang="zh" className="font-cn font-semibold text-jade-dark">{answer}</span>
      </p>
      {script && (
        <div>
          <p className="text-[11px] font-semibold text-muted">대본</p>
          <p lang="zh" className="mt-0.5 whitespace-pre-wrap font-cn text-sm text-ink">{script}</p>
        </div>
      )}
      {explanation && (
        <div>
          <p className="text-[11px] font-semibold text-muted">해설</p>
          <p className="mt-0.5 text-sm text-bodytx">{explanation}</p>
        </div>
      )}
    </div>
  );
}
