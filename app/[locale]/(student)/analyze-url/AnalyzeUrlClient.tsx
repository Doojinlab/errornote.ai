"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import type { AnalyzeUrlResponse, UrlAnalysisResult, UrlVocabAnnotation } from "@/types/url-analysis";

const REGISTER_BADGE: Record<UrlVocabAnnotation["register"], string> = {
  formal: "bg-blue-soft text-blue-dark",
  colloquial: "bg-jade-soft text-jade-dark",
  internet_slang: "bg-gem-soft text-gem-dark",
  literary: "bg-gold-soft text-gold-dark",
  neutral: "bg-ivory text-bodytx",
};

export default function AnalyzeUrlClient() {
  const t = useTranslations("pages.student.urlAnalyze");
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [convertToCards, setConvertToCards] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeUrlResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), convertToCards }),
      });
      const json = (await res.json()) as AnalyzeUrlResponse | { error?: string };
      if (!res.ok) {
        throw new Error(("error" in json && json.error) || `요청 실패 (${res.status})`);
      }
      setResult(json as AnalyzeUrlResponse);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-medium text-bodytx">
            {t("urlLabel")}
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              className="mt-1 block w-full rounded-md border border-hairline px-3 py-2 text-sm text-ink focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              disabled={isLoading}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-bodytx">
            <input
              type="checkbox"
              checked={convertToCards}
              onChange={(e) => setConvertToCards(e.target.checked)}
              className="rounded border-hairline text-blue focus:ring-blue"
              disabled={isLoading}
            />
            {t("convertToCardsLabel")}
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">{t("supportedSourcesHint")}</p>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-dark disabled:opacity-60"
            >
              {isLoading ? t("analyzing") : t("analyze")}
            </button>
          </div>

          {error && <p className="text-xs text-terra">{error}</p>}
        </form>
      </Card>

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: AnalyzeUrlResponse }) {
  const t = useTranslations("pages.student.urlAnalyze");
  const r: UrlAnalysisResult = result.record.analysis_result;

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted">{t("resultHeading")}</p>
        <h2 className="mt-1 text-sm font-semibold text-ink">{r.overall_register || "—"}</h2>
        <p className="mt-1 text-[11px] text-muted">
          {t("estimatedHsk", { level: r.estimated_hsk_level ?? "?" })}
          {" · "}
          <a
            href={result.record.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue hover:underline"
          >
            {t("viewSource")}
          </a>
        </p>
      </div>

      {r.study_points.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-bodytx">{t("studyPointsHeading")}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-bodytx">
            {r.study_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <AnnotationsBlock title={t("annotationsHeading")} items={r.annotations} />

      {r.internet_slang.length > 0 && (
        <AnnotationsBlock title={t("slangHeading")} items={r.internet_slang} />
      )}

      {result.cards && result.cards.length > 0 && (
        <div className="rounded border border-jade bg-jade-soft p-3">
          <p className="text-xs font-semibold text-jade-dark">
            {t("cardsConverted", { count: result.cards.length })}
          </p>
          <p className="mt-0.5 text-[11px] text-jade-dark">{t("cardsConvertedHint")}</p>
        </div>
      )}
    </Card>
  );
}

function AnnotationsBlock({
  title,
  items,
}: {
  title: string;
  items: UrlVocabAnnotation[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-bodytx">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((a, i) => (
          <li key={i} className="rounded border border-hairline bg-ivory p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span lang="zh" className="font-cn text-sm font-semibold text-ink">{a.span}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REGISTER_BADGE[a.register]}`}
                >
                  {a.register}
                </span>
                {a.hsk_level !== null && (
                  <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[10px] font-medium text-blue-dark">
                    HSK {a.hsk_level}
                  </span>
                )}
              </div>
            </div>
            {a.meaning_ko && <p className="mt-1 text-xs text-bodytx">{a.meaning_ko}</p>}
            {a.note && <p className="mt-0.5 text-[11px] text-muted">{a.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
