"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Card from "@/components/ui/Card";
import type { GradedReadingResponse } from "@/app/api/graded-reading/route";

export default function GradedReadingClient() {
  const t = useTranslations("pages.student.gradedReading");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GradedReadingResponse | null>(null);

  async function generate() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graded-reading", { method: "POST" });
      const json = (await res.json()) as GradedReadingResponse | { error?: string };
      if (!res.ok) {
        throw new Error(("error" in json && json.error) || `요청 실패 (${res.status})`);
      }
      setData(json as GradedReadingResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-bodytx">
          {data ? t("regenerateHint") : t("emptyHint")}
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={isLoading}
          className="mt-3 rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-dark disabled:opacity-60"
        >
          {isLoading ? t("generating") : data ? t("regenerate") : t("generate")}
        </button>
        {error && <p className="mt-2 text-xs text-terra">{error}</p>}
      </Card>

      {data && <ReadingView data={data} />}
    </div>
  );
}

function ReadingView({ data }: { data: GradedReadingResponse }) {
  const t = useTranslations("pages.student.gradedReading");
  const { reading, weakGrammar, hskLevel } = data;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 lang="zh" className="font-cn text-base font-bold text-ink">
            {reading.title || "—"}
          </h2>
          <span className="shrink-0 rounded bg-blue-soft px-2 py-0.5 text-[10px] font-semibold text-blue-dark">
            {t("hskLevelLabel", { level: hskLevel })}
          </span>
        </div>
        <p
          lang="zh"
          className="mt-2 whitespace-pre-wrap font-cn text-[15px] leading-relaxed text-ink"
        >
          {reading.text}
        </p>
      </div>

      <div className="rounded border border-hairline bg-ivory p-3">
        <h3 className="text-xs font-semibold text-bodytx">{t("targetedGrammar")}</h3>
        {weakGrammar.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted">{t("noWeakness")}</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {weakGrammar.map((g) => (
              <span
                key={g}
                className="rounded bg-terra-soft px-2 py-0.5 text-[11px] font-medium text-terra-dark"
              >
                {g}
              </span>
            ))}
          </div>
        )}
        {reading.targetGrammar.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-bodytx">
            {reading.targetGrammar.map((g, i) => (
              <li key={i}>
                <span className="font-semibold text-ink">{g.point}</span>
                {g.example && (
                  <>
                    {" — "}
                    <span lang="zh" className="font-cn">
                      {g.example}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {reading.glossary.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-bodytx">{t("glossaryHeading")}</h3>
          <ul className="mt-1.5 space-y-1">
            {reading.glossary.map((g, i) => (
              <li key={i} className="text-xs text-bodytx">
                <span lang="zh" className="font-cn font-semibold text-ink">
                  {g.word}
                </span>{" "}
                <span className="text-muted">[{g.pinyin}]</span> {g.ko}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reading.questions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-bodytx">{t("questionsHeading")}</h3>
          <ol className="mt-1.5 space-y-2">
            {reading.questions.map((q, i) => (
              <QuestionItem key={i} index={i + 1} q={q.q} answer={q.answer} />
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

function QuestionItem({
  index,
  q,
  answer,
}: {
  index: number;
  q: string;
  answer: string;
}) {
  const t = useTranslations("pages.student.gradedReading");
  const [show, setShow] = useState(false);

  return (
    <li className="rounded border border-hairline bg-ivory p-2">
      <p lang="zh" className="font-cn text-sm text-ink">
        {index}. {q}
      </p>
      {show ? (
        <p lang="zh" className="mt-1 font-cn text-sm font-semibold text-jade-dark">
          {answer}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="mt-1 text-[11px] font-semibold text-blue hover:underline"
        >
          {t("showAnswer")}
        </button>
      )}
    </li>
  );
}
