"use client";
import { useTranslations } from "next-intl";
import ErrorCard from "./ErrorCard";
import type { AnalysisResponse } from "@/types";

interface Props {
  analysis: AnalysisResponse | null;
  focusedErrorId: number | null;
  onFocusError: (id: number) => void;
  isLoading?: boolean;
}

export default function ErrorPanel({
  analysis,
  focusedErrorId,
  onFocusError,
  isLoading,
}: Props) {
  const t = useTranslations("pages.components.errorPanel");
  return (
    <div className="flex h-full flex-col overflow-hidden bg-ivory">
      <header className="flex items-center justify-between gap-2 border-b border-hairline bg-white px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          🎴 {analysis ? t("headingWithCount", { count: analysis.error_count }) : t("headingBase")}
        </h2>
        {analysis && analysis.errors.length > 0 && (
          <div className="flex items-center gap-1">
            {analysis.errors.map((err) => (
              <button
                key={err.id}
                type="button"
                onClick={() => onFocusError(err.id)}
                aria-label={String(err.id)}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  focusedErrorId === err.id
                    ? "bg-terra text-white"
                    : "bg-hairline text-muted hover:bg-terra-soft hover:text-terra-dark"
                }`}
              >
                {err.id}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl2 border border-hairline bg-white/60"
              />
            ))}
          </div>
        )}
        {!isLoading && !analysis && (
          <p className="mt-8 text-center text-sm text-muted">{t("emptyState")}</p>
        )}
        {analysis && analysis.error_count === 0 && (
          <p className="rounded-xl2 bg-jade-soft p-4 text-center text-sm font-medium text-jade-dark">
            {t("zeroErrors")}
          </p>
        )}
        {analysis?.errors.map((err) => (
          <ErrorCard
            key={err.id}
            error={err}
            isFocused={focusedErrorId === err.id}
            onFocus={() => onFocusError(err.id)}
          />
        ))}
        {analysis?.overall_feedback && (
          <div className="rounded-xl2 border border-blue-soft bg-blue-soft/40 p-3 text-sm">
            <p className="font-semibold text-blue-dark">{t("overallFeedback")}</p>
            <p className="mt-1 text-bodytx">{analysis.overall_feedback}</p>
          </div>
        )}
        {analysis?.fluency_suggestion && (
          <div className="rounded-xl2 border border-hairline bg-white p-3 text-sm">
            <p className="font-semibold text-muted">{t("fluencySuggestion")}</p>
            <p className="mt-1 text-bodytx">{analysis.fluency_suggestion}</p>
          </div>
        )}
      </div>
    </div>
  );
}
