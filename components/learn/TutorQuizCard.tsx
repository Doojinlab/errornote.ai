"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TutorQuiz } from "@/lib/tutor-tools";

interface Props {
  quiz: TutorQuiz;
}

/** 튜터 generate_quiz 도구 산출물 렌더. 보기 클릭 시 정/오답 즉시 표시. */
export default function TutorQuizCard({ quiz }: Props) {
  const t = useTranslations("pages.components.tutorChat");
  const [picked, setPicked] = useState<Record<number, number>>({});

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
      <p className="text-xs font-semibold text-indigo-700">
        🎯 {t("quizHeading")}
        {quiz.topic ? ` · ${quiz.topic}` : ""}
      </p>
      {quiz.questions.map((q, qi) => {
        const chosen = picked[qi];
        const answered = chosen !== undefined;
        return (
          <div key={qi} className="rounded-md bg-white p-2.5 shadow-sm">
            <p className="text-sm font-medium text-slate-800">
              {qi + 1}. {q.prompt}
            </p>
            <ul className="mt-2 space-y-1">
              {q.options.map((opt, oi) => {
                const isAnswer = oi === q.answerIndex;
                const isChosen = chosen === oi;
                let cls = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
                if (answered && isAnswer) cls = "border-emerald-300 bg-emerald-50 text-emerald-800";
                else if (answered && isChosen) cls = "border-red-300 bg-red-50 text-red-700";
                return (
                  <li key={oi}>
                    <button
                      type="button"
                      disabled={answered}
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      className={`w-full rounded border px-2.5 py-1.5 text-left text-sm transition-colors disabled:cursor-default ${cls}`}
                    >
                      {opt}
                      {answered && isAnswer && " ✓"}
                      {answered && isChosen && !isAnswer && " ✗"}
                    </button>
                  </li>
                );
              })}
            </ul>
            {answered && (
              <p
                className={`mt-1.5 text-xs ${chosen === q.answerIndex ? "text-emerald-700" : "text-red-600"}`}
              >
                {chosen === q.answerIndex ? t("quizCorrect") : t("quizWrong")}
                {q.explanation ? ` — ${q.explanation}` : ""}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
