"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, CircleCheck, CircleX, NotebookPen } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { TutorQuiz } from "@/lib/tutor-tools";

interface Props {
  quiz: TutorQuiz;
  chapterNumber?: number;
  onClose: () => void;
}

/**
 * 연습 퀴즈를 화면 중앙 대형 모달로 렌더한다(좁은 채팅 창 대신). 보기를 고르면 즉시
 * 정/오답을 표시하고, 오답인 문항은 스냅샷을 /api/quiz-mistakes 로 자동 저장한다
 * (오답 노트 라이브러리에서 날짜별 열람). 저장은 비치명적 — 실패해도 풀이를 막지 않는다.
 */
export default function QuizModal({ quiz, chapterNumber, onClose }: Props) {
  const t = useTranslations("pages.components.tutorChat");
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [savedWrong, setSavedWrong] = useState(false);
  // 같은 문항을 재저장하지 않도록 기록한 문항 인덱스를 기억한다.
  const recordedRef = useRef<Set<number>>(new Set());

  // Esc 로 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recordWrong = useCallback(
    (qi: number, chosenIndex: number) => {
      if (recordedRef.current.has(qi)) return;
      recordedRef.current.add(qi);
      const q = quiz.questions[qi];
      // fire-and-forget — 응답을 기다리지 않는다(풀이 흐름 비차단).
      void fetch("/api/quiz-mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: quiz.topic,
          prompt: q.prompt,
          options: q.options,
          chosenIndex,
          answerIndex: q.answerIndex,
          explanation: q.explanation ?? null,
          chapterNumber: chapterNumber ?? null,
        }),
      })
        .then((res) => {
          if (res.ok) setSavedWrong(true);
        })
        .catch(() => {
          /* 저장 실패는 무시 */
        });
    },
    [quiz, chapterNumber],
  );

  function choose(qi: number, oi: number) {
    if (picked[qi] !== undefined) return;
    setPicked((p) => ({ ...p, [qi]: oi }));
    if (oi !== quiz.questions[qi].answerIndex) recordWrong(qi, oi);
  }

  const total = quiz.questions.length;
  const done = Object.keys(picked).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("quizHeading")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-[min(94vw,42rem)] flex-col overflow-hidden rounded-xl3 border border-hairline bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
          <span className="text-lg" aria-hidden>
            🎯
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-ink">
              {t("quizHeading")}
              {quiz.topic ? ` · ${quiz.topic}` : ""}
            </p>
            <p className="text-xs text-muted">
              {t("quizProgress", { done, total })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("quizCloseCta")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-bodytx hover:bg-ivory"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* 문항 목록(스크롤) */}
        <div className="min-h-0 flex-1 space-y-5 overflow-auto px-5 py-5">
          {quiz.questions.map((q, qi) => {
            const chosen = picked[qi];
            const answered = chosen !== undefined;
            const correct = answered && chosen === q.answerIndex;
            return (
              <div key={qi} className="rounded-xl2 border border-hairline bg-ivory/60 p-4">
                <p className="text-[15px] font-bold leading-7 text-ink">
                  <span className="mr-1 text-blue-dark">{qi + 1}.</span>
                  {q.prompt}
                </p>
                <ul className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => {
                    const isAnswer = oi === q.answerIndex;
                    const isChosen = chosen === oi;
                    let cls =
                      "border-hairline bg-white text-ink hover:border-blue hover:bg-blue-soft/40";
                    if (answered && isAnswer)
                      cls = "border-jade bg-jade-soft text-jade-dark";
                    else if (answered && isChosen)
                      cls = "border-terra bg-terra-soft text-terra";
                    else if (answered) cls = "border-hairline bg-white text-muted";
                    return (
                      <li key={oi}>
                        <button
                          type="button"
                          disabled={answered}
                          onClick={() => choose(qi, oi)}
                          className={`flex w-full items-center gap-2 rounded-xl2 border px-4 py-3 text-left text-[15px] transition-colors disabled:cursor-default ${cls}`}
                        >
                          <span className="flex-1">{opt}</span>
                          {answered && isAnswer && (
                            <CircleCheck size={18} className="shrink-0 text-jade-dark" aria-hidden />
                          )}
                          {answered && isChosen && !isAnswer && (
                            <CircleX size={18} className="shrink-0 text-terra" aria-hidden />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {answered && (
                  <p
                    className={`mt-3 text-sm font-medium ${correct ? "text-jade-dark" : "text-terra"}`}
                  >
                    {correct ? t("quizCorrect") : t("quizWrong")}
                    {q.explanation ? (
                      <span className="mt-1 block font-normal text-bodytx">{q.explanation}</span>
                    ) : null}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* 푸터 — 오답 노트 안내/링크 */}
        <div className="flex items-center gap-3 border-t border-hairline px-5 py-3">
          <span className="min-w-0 flex-1 text-xs text-muted">
            {savedWrong ? (
              <span className="inline-flex items-center gap-1 font-medium text-terra">
                <NotebookPen size={14} aria-hidden />
                {t("quizSavedToNotes")}
              </span>
            ) : (
              t("quizNotesHint")
            )}
          </span>
          <Link
            href="/quiz-mistakes"
            className="shrink-0 rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-blue-dark hover:bg-blue-soft/50"
          >
            {t("quizViewNotes")}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white"
          >
            {t("quizCloseCta")}
          </button>
        </div>
      </div>
    </div>
  );
}
