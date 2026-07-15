"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Play, PenLine, RotateCcw } from "lucide-react";
import type HanziWriterClass from "hanzi-writer";
import type { CharacterJson } from "hanzi-writer";
import Card from "@/components/ui/Card";
import { HANZI_CHARS, hanziDataUrl, type HanziEntry } from "@/lib/handwriting";

type Writer = InstanceType<typeof HanziWriterClass>;

const SIZE = 220;

interface QuizState {
  active: boolean;
  done: number;
  total: number;
  mistakes: number;
  complete: boolean;
}
const INITIAL_QUIZ: QuizState = { active: false, done: 0, total: 0, mistakes: 0, complete: false };

export default function HandwritingClient() {
  const t = useTranslations("pages.student.handwriting");

  const [selected, setSelected] = useState<HanziEntry>(HANZI_CHARS[0]);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [quiz, setQuiz] = useState<QuizState>(INITIAL_QUIZ);

  const targetRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<Writer | null>(null);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    let cancelled = false;
    el.innerHTML = "";
    writerRef.current = null;
    setStatus("loading");
    setMessage("");
    setQuiz(INITIAL_QUIZ);

    void import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (cancelled || !targetRef.current) return;
      const writer = HanziWriter.create(targetRef.current, selected.char, {
        width: SIZE,
        height: SIZE,
        padding: 12,
        showOutline: true,
        showCharacter: true,
        strokeColor: "#1f2a37",
        radicalColor: "#2f6df6",
        drawingColor: "#178a66",
        charDataLoader: (char, onLoad, onError) => {
          fetch(hanziDataUrl(char))
            .then((r) => {
              if (!r.ok) throw new Error(String(r.status));
              return r.json();
            })
            .then((d) => onLoad(d as CharacterJson))
            .catch((e) => onError(e));
        },
        onLoadCharDataSuccess: () => {
          if (!cancelled) setStatus("ready");
        },
        onLoadCharDataError: () => {
          if (!cancelled) {
            setStatus("error");
            setMessage(t("loadError"));
          }
        },
      });
      writerRef.current = writer;
    });

    return () => {
      cancelled = true;
    };
  }, [selected, reloadKey, t]);

  const animate = useCallback(() => {
    setQuiz(INITIAL_QUIZ);
    setMessage("");
    writerRef.current?.animateCharacter();
  }, []);

  const startQuiz = useCallback(() => {
    const w = writerRef.current;
    if (!w) return;
    setQuiz({ ...INITIAL_QUIZ, active: true });
    setMessage(t("quizStart"));
    void w.quiz({
      onCorrectStroke: (s) => {
        setQuiz((q) => ({
          ...q,
          done: s.strokeNum + 1,
          total: s.strokeNum + 1 + s.strokesRemaining,
          mistakes: s.totalMistakes,
        }));
        setMessage(t("correctStroke"));
      },
      onMistake: (s) => {
        setQuiz((q) => ({ ...q, mistakes: s.totalMistakes }));
        setMessage(t("mistake"));
      },
      onComplete: (sum) => {
        setQuiz((q) => ({ ...q, active: false, complete: true, mistakes: sum.totalMistakes }));
        setMessage(t("complete", { mistakes: sum.totalMistakes }));
      },
    });
  }, [t]);

  const reset = useCallback(() => {
    writerRef.current?.cancelQuiz();
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-4">
      {/* 글자 선택 */}
      <Card className="p-3">
        <p className="mb-2 text-xs font-semibold text-bodytx">{t("pickChar")}</p>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {HANZI_CHARS.map((e) => (
            <button
              key={e.char}
              type="button"
              onClick={() => setSelected(e)}
              aria-pressed={e.char === selected.char}
              lang="zh"
              className={`aspect-square rounded-md border font-cn text-lg transition-colors ${
                e.char === selected.char
                  ? "border-blue bg-blue text-white"
                  : "border-hairline bg-white text-ink hover:bg-blue-soft"
              }`}
            >
              {e.char}
            </button>
          ))}
        </div>
      </Card>

      {/* 쓰기 판 */}
      <Card className="flex flex-col items-center gap-3 p-4">
        <div className="text-center">
          <span lang="zh" className="font-cn text-xl font-bold text-ink">
            {selected.char}
          </span>
          <span className="ml-2 text-sm text-bodytx">{selected.pinyin}</span>
          <span className="ml-1 text-xs text-muted">· {selected.meaning}</span>
        </div>

        {/* 田字格 배경 + hanzi-writer SVG */}
        <div
          className="relative rounded-lg border border-hairline bg-white"
          style={{ width: SIZE, height: SIZE }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
              backgroundSize: `${SIZE / 2}px ${SIZE / 2}px`,
              backgroundPosition: "center",
            }}
          />
          <div ref={targetRef} className="relative" />
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
              {t("loading")}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={animate}
            disabled={status !== "ready"}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-soft px-3 py-1.5 text-xs font-bold text-blue-dark disabled:opacity-50"
          >
            <Play size={14} aria-hidden />
            {t("showStroke")}
          </button>
          <button
            type="button"
            onClick={startQuiz}
            disabled={status !== "ready"}
            className="inline-flex items-center gap-1.5 rounded-md bg-jade px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <PenLine size={14} aria-hidden />
            {t("practice")}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white px-3 py-1.5 text-xs font-bold text-bodytx"
          >
            <RotateCcw size={14} aria-hidden />
            {t("reset")}
          </button>
        </div>

        {(quiz.active || quiz.complete) && (
          <p className="text-xs font-semibold text-bodytx">
            {t("progress", { done: quiz.done, total: quiz.total || "?", mistakes: quiz.mistakes })}
          </p>
        )}
        {message && (
          <p
            className={`text-center text-sm ${
              status === "error" ? "text-terra" : quiz.complete ? "text-jade-dark" : "text-bodytx"
            }`}
          >
            {message}
          </p>
        )}
      </Card>
    </div>
  );
}
