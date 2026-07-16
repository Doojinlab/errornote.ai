"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, PenLine, ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import Card from "@/components/ui/Card";
import ListeningPlayer from "./ListeningPlayer";
import type { HskSessionParams } from "@/lib/hsk";
import type { HskSessionType } from "@/types";
import type { HskQuestion, HskListeningQuestion } from "@/types/hsk";

// A-α: 영역별 문제 1개를 생성·제시하는 MVP 세션.
// 연습/실전 타이머·성적표·문항 네비·A-6 오디오 컨트롤은 후속(A-β/δ)에서 확장.

export default function HskSessionClient({
  params,
  chapterId,
}: {
  params: HskSessionParams;
  chapterId: string;
}) {
  const router = useRouter();
  const { level, area, mode } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState<HskListeningQuestion | null>(null);
  const [question, setQuestion] = useState<HskQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setListening(null);
    setQuestion(null);
    try {
      if (area === "listening") {
        const res = await fetch("/api/hsk/listening/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        });
        const json = (await res.json()) as { question: HskListeningQuestion; error?: string };
        if (!res.ok) throw new Error(json.error ?? "생성 실패");
        setListening(json.question);
      } else {
        const res = await fetch("/api/hsk/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level, area, mode }),
        });
        const json = (await res.json()) as { question: HskQuestion; error?: string };
        if (!res.ok) throw new Error(json.error ?? "생성 실패");
        setQuestion(json.question);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제 생성에 실패했어요.");
    } finally {
      setLoading(false);
    }
  }, [area, level, mode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/선택 변경 시 1회 문제 생성(로딩 상태 진입). 의도적 fetch-on-mount.
    void generate();
  }, [generate]);

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

  // 개념 학습 — 타이머·채점 대상 아님(설명 카드).
  if (mode === "concept" && question) {
    return (
      <div className="space-y-3">
        <Card className="space-y-2 p-4">
          <p className="text-xs font-semibold text-blue-dark">{question.type}</p>
          <p className="text-sm text-bodytx">{question.instructions}</p>
          {question.passage && (
            <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] leading-relaxed text-ink">
              {question.passage}
            </p>
          )}
          <p lang="zh" className="whitespace-pre-wrap font-cn text-sm text-ink">{question.prompt}</p>
          {question.explanation && (
            <div className="rounded-md border border-hairline bg-ivory p-3">
              <p className="text-[11px] font-semibold text-muted">해설</p>
              <p className="mt-0.5 text-sm text-bodytx">{question.explanation}</p>
            </div>
          )}
        </Card>
        <NextButton onClick={() => void generate()} label="다음 개념" />
      </div>
    );
  }

  // 쓰기 — 题目 제시 후 작문 워크스페이스로 연결(교정 파이프라인 재사용).
  if (area === "writing" && question) {
    const q = new URLSearchParams({
      mode: "hsk",
      level: String(level),
      area: "writing",
      hskMode: mode,
    });
    return (
      <div className="space-y-3">
        <Card className="space-y-2 p-4">
          <p className="text-xs font-semibold text-blue-dark">작문 题目 · {question.type}</p>
          <p className="text-sm text-bodytx">{question.instructions}</p>
          <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] font-semibold leading-relaxed text-ink">
            {question.prompt}
          </p>
        </Card>
        <button
          type="button"
          onClick={() => router.push(`/learn/${chapterId}?${q.toString()}`)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-blue bg-gradient-to-b from-white to-blue-soft text-sm font-semibold text-blue transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <PenLine size={16} aria-hidden />
          작문하러 가기
          <ArrowRight size={16} aria-hidden />
        </button>
        <NextButton onClick={() => void generate()} label="다른 题目" />
      </div>
    );
  }

  // 듣기 — 오디오(대본 TTS + A-6 컨트롤) + 4지선다.
  if (area === "listening" && listening) {
    return (
      <div className="space-y-3">
        <ListeningView
          q={listening}
          selected={selected}
          onSelect={setSelected}
          sessionType={params.sessionType}
        />
        <NextButton onClick={() => void generate()} label="다음 문제" />
      </div>
    );
  }

  // 독해 등 — 지문 + 4지선다.
  if (question) {
    return (
      <div className="space-y-3">
        <ReadingView q={question} selected={selected} onSelect={setSelected} />
        <NextButton onClick={() => void generate()} label="다음 문제" />
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

/** 4지선다 공통 — 선택 시 즉시 정오 표시(A-α MVP). */
function Choices({
  options,
  answer,
  selected,
  onSelect,
}: {
  options: string[];
  answer?: string;
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  const revealed = selected !== null;
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const isAnswer = answer !== undefined && opt === answer;
        const isPicked = opt === selected;
        let cls = "border-hairline bg-white text-bodytx";
        if (revealed && isAnswer) cls = "border-jade bg-jade-soft text-jade-dark";
        else if (revealed && isPicked) cls = "border-terra bg-terra-soft text-terra-dark";
        return (
          <button
            key={opt}
            type="button"
            disabled={revealed}
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

function ListeningView({
  q,
  selected,
  onSelect,
  sessionType,
}: {
  q: HskListeningQuestion;
  selected: string | null;
  onSelect: (v: string) => void;
  sessionType?: HskSessionType;
}) {
  const revealed = selected !== null;
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-bodytx">{q.instructions}</p>
      <ListeningPlayer
        audioScript={q.audioScript}
        scriptPinyin={q.scriptPinyin}
        scriptTranslation={q.scriptTranslation}
        sessionType={sessionType}
      />
      <p className="text-sm font-semibold text-ink">{q.question}</p>
      <Choices options={q.options} answer={q.answer} selected={selected} onSelect={onSelect} />
      {revealed && (
        <Explain answer={q.answer} explanation={q.explanation} script={q.audioScript} />
      )}
    </Card>
  );
}

function ReadingView({
  q,
  selected,
  onSelect,
}: {
  q: HskQuestion;
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  const revealed = selected !== null;
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-bodytx">{q.instructions}</p>
      {q.passage && (
        <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] leading-relaxed text-ink">
          {q.passage}
        </p>
      )}
      <p lang="zh" className="font-cn text-sm font-semibold text-ink">{q.prompt}</p>
      {q.options && q.options.length > 0 ? (
        <>
          <Choices options={q.options} answer={q.answer} selected={selected} onSelect={onSelect} />
          {revealed && <Explain answer={q.answer} explanation={q.explanation} />}
        </>
      ) : (
        q.explanation && (
          <div className="rounded-md border border-hairline bg-ivory p-3 text-sm text-bodytx">
            {q.explanation}
          </div>
        )
      )}
    </Card>
  );
}

function Explain({
  answer,
  explanation,
  script,
}: {
  answer?: string;
  explanation?: string;
  script?: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-hairline bg-ivory p-3">
      {answer && (
        <p className="text-xs text-bodytx">
          정답:{" "}
          <span lang="zh" className="font-cn font-semibold text-jade-dark">{answer}</span>
        </p>
      )}
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
