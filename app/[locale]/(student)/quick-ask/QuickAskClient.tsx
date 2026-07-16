"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Card from "@/components/ui/Card";
import type { NaturalnessResult } from "@/lib/quick-ask";

const MAX_LEN = 300;

const VERDICT_BADGE: Record<NaturalnessResult["verdict"], string> = {
  natural: "bg-jade-soft text-jade-dark",
  awkward: "bg-gold-soft text-gold-dark",
  incorrect: "bg-terra-soft text-terra-dark",
};

export default function QuickAskClient() {
  const t = useTranslations("pages.student.quickAsk");

  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NaturalnessResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/quick-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = (await res.json()) as NaturalnessResult | { error?: string };
      if (!res.ok) {
        throw new Error(("error" in json && json.error) || `요청 실패 (${res.status})`);
      }
      setResult(json as NaturalnessResult);
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
            {t("inputLabel")}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder={t("placeholder")}
              rows={3}
              lang="zh"
              className="mt-1 block w-full resize-none rounded-md border border-hairline px-3 py-2 font-cn text-sm text-ink focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
              disabled={isLoading}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              {t("hint")} · {text.length}/{MAX_LEN}
            </p>
            <button
              type="submit"
              disabled={isLoading || !text.trim()}
              className="rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-dark disabled:opacity-60"
            >
              {isLoading ? t("checking") : t("submit")}
            </button>
          </div>

          {error && <p className="text-xs text-terra">{error}</p>}
        </form>
      </Card>

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: NaturalnessResult }) {
  const t = useTranslations("pages.student.quickAsk");

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${VERDICT_BADGE[result.verdict]}`}
        >
          {t(`verdict.${result.verdict}`)}
        </span>
        <span className="text-[11px] font-semibold text-muted">
          {t("scoreLabel", { score: result.score })}
        </span>
      </div>

      {result.suggestion && (
        <div>
          <h3 className="text-xs font-semibold text-bodytx">{t("suggestionHeading")}</h3>
          <p lang="zh" className="mt-1 font-cn text-sm font-semibold text-ink">
            {result.suggestion}
          </p>
        </div>
      )}

      {result.note && (
        <div>
          <h3 className="text-xs font-semibold text-bodytx">{t("noteHeading")}</h3>
          <p className="mt-1 text-sm text-bodytx">{result.note}</p>
        </div>
      )}
    </Card>
  );
}
