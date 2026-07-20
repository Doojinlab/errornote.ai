"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import QuizSession from "./QuizSession";
import WritingWorkspace from "./WritingWorkspace";
import { isGradableItem, type QuizItem } from "@/lib/hsk-quiz";
import { hskAreaLabel } from "@/lib/hsk";
import type { HskSessionParams } from "@/lib/hsk";
import type { HskQuestion, HskListeningQuestion } from "@/types/hsk";

interface DrillState {
  answers: Record<number, string>;
  index: number;
  flagged: number[];
}
interface PersistedDrill extends DrillState {
  items: QuizItem[];
}

const SET_SIZE = 5;

export default function HskSessionClient({
  params,
  chapterId,
  classId,
}: {
  params: HskSessionParams;
  chapterId: string;
  /** 쓰기 AI 분석용 활성 수업 id(쓰기 영역에서만 필요). */
  classId: string | null;
}) {
  const { level, area, mode } = params;
  // 다문항 세트(듣기·독해 문제 풀이) vs 단일(개념·쓰기).
  const isQuiz = mode === "practice" && (area === "listening" || area === "reading");
  // 오답 적립 topic + 연습(drill) 이어풀기 저장 키(실전은 저장 안 함, A-9).
  const topic = `HSK ${level}급 ${hskAreaLabel(area)}`;
  const storageKey =
    isQuiz && params.sessionType === "drill"
      ? `hsk-drill:${level}:${area}:${params.gradingMode ?? "immediate"}`
      : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<QuizItem[]>([]);
  const [single, setSingle] = useState<HskQuestion | null>(null);
  const [restored, setRestored] = useState<DrillState | null>(null);

  const genListening = useCallback(async (): Promise<QuizItem | null> => {
    const res = await fetch("/api/hsk/listening/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    });
    if (!res.ok) return null;
    const { question } = (await res.json()) as { question: HskListeningQuestion };
    return {
      kind: "listening",
      instructions: question.instructions,
      question: question.question,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      audioScript: question.audioScript,
      scriptPinyin: question.scriptPinyin,
      scriptTranslation: question.scriptTranslation,
      cast: question.cast,
    };
  }, [level]);

  const genReading = useCallback(async (): Promise<QuizItem | null> => {
    const res = await fetch("/api/hsk/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, area: "reading", mode: "practice" }),
    });
    if (!res.ok) return null;
    const { question } = (await res.json()) as { question: HskQuestion };
    return {
      kind: "reading",
      instructions: question.instructions,
      question: question.prompt,
      options: question.options ?? [],
      answer: question.answer ?? "",
      explanation: question.explanation ?? "",
      passage: question.passage,
    };
  }, [level]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setSingle(null);
    setRestored(null);
    try {
      if (isQuiz) {
        const gen = area === "listening" ? genListening : genReading;
        const results = await Promise.all(
          Array.from({ length: SET_SIZE }, () => gen().catch(() => null)),
        );
        const valid = results.filter((x): x is QuizItem => x !== null).filter(isGradableItem);
        if (valid.length < 2) {
          setError("문제를 충분히 만들지 못했어요. 다시 시도해 주세요.");
          return;
        }
        setItems(valid);
      } else {
        // 개념·쓰기: 단일 문항.
        const res = await fetch("/api/hsk/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level, area, mode }),
        });
        const json = (await res.json()) as { question: HskQuestion; error?: string };
        if (!res.ok) throw new Error(json.error ?? "생성 실패");
        setSingle(json.question);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }, [isQuiz, area, mode, level, genListening, genReading]);

  // 마운트 시: 연습(drill) 저장 세션이 있으면 이어풀기 복원, 없으면 생성(A-9).
  const bootstrap = useCallback(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as PersistedDrill;
          if (Array.isArray(saved?.items) && saved.items.length >= 2) {
            setItems(saved.items);
            setRestored({
              answers: saved.answers ?? {},
              index: saved.index ?? 0,
              flagged: saved.flagged ?? [],
            });
            setError(null);
            setLoading(false);
            return;
          }
        }
      } catch {
        /* 손상된 저장값은 무시하고 새로 생성 */
      }
    }
    void generate();
  }, [storageKey, generate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 이어풀기 복원 또는 생성. 의도적.
    bootstrap();
  }, [bootstrap]);

  if (loading) return <SessionSkeleton />;

  if (error) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <p className="text-sm text-terra">{error}</p>
        <button
          type="button"
          onClick={() => void generate()}
          className="rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white"
        >
          다시 시도
        </button>
      </Card>
    );
  }

  // 다문항 세션(듣기·독해 문제 풀이)
  if (isQuiz && items.length > 0) {
    return (
      <QuizSession
        items={items}
        gradingMode={params.gradingMode ?? "immediate"}
        sessionType={params.sessionType}
        topic={topic}
        storageKey={storageKey}
        initialState={restored ?? undefined}
        onRetry={() => void generate()}
      />
    );
  }

  // 개념 학습 — 설명 카드(타이머·채점 제외)
  if (mode === "concept" && single) {
    return (
      <div className="space-y-3">
        <Card className="space-y-2 p-4">
          <p className="text-xs font-semibold text-blue-dark">{single.type}</p>
          <p className="text-sm text-bodytx">{single.instructions}</p>
          {single.passage && (
            <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] leading-relaxed text-ink">
              {single.passage}
            </p>
          )}
          <p lang="zh" className="whitespace-pre-wrap font-cn text-sm text-ink">{single.prompt}</p>
          {single.explanation && (
            <div className="rounded-md border border-hairline bg-ivory p-3">
              <p className="text-[11px] font-semibold text-muted">해설</p>
              <p className="mt-0.5 text-sm text-bodytx">{single.explanation}</p>
            </div>
          )}
        </Card>
        <NextButton onClick={() => void generate()} label="다음 개념" />
      </div>
    );
  }

  // 쓰기 — 题目 + 작문 워크스페이스 임베드(에디터 + 오류카드/AI 과외 토글). 바로 작성.
  if (area === "writing" && single) {
    return (
      <div className="space-y-3">
        <WritingWorkspace question={single} classId={classId} chapterId={chapterId} />
        <NextButton onClick={() => void generate()} label="다른 题目" />
      </div>
    );
  }

  return null;
}

function NextButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-soft px-3 py-1.5 text-xs font-bold text-blue-dark hover:bg-blue-soft/70"
    >
      <Sparkles size={14} aria-hidden />
      {label}
    </button>
  );
}

function SessionSkeleton() {
  return (
    <Card className="space-y-3 p-4" aria-busy="true" aria-label="문제 생성 중">
      <div className="h-4 w-24 animate-pulse rounded bg-blue-soft" />
      <div className="h-3 w-full animate-pulse rounded bg-hairline" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-hairline" />
      <div className="mt-2 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-ivory" />
        ))}
      </div>
    </Card>
  );
}
