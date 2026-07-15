"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ErrorCard from "./ErrorCard";
import type { AnalysisResponse } from "@/types";

// 분석 대기 동안 "진행되는 느낌"을 주는 단계 메시지(스켈레톤 하단에서 순환).
// 분석 산출물은 구조화 JSON 이라 토큰 스트리밍이 사용자에게 무의미하므로,
// API 계약을 건드리지 않고 클라이언트에서 단계 안내만 순환시킨다.
const LOADING_STAGE_KEYS = ["loadingStage1", "loadingStage2", "loadingStage3"] as const;

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
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(
      () => setStage((s) => (s + 1) % LOADING_STAGE_KEYS.length),
      1400
    );
    return () => clearInterval(id);
  }, [isLoading]);
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
            <p className="flex items-center gap-2 text-sm font-medium text-terra-dark">
              <span className="h-2 w-2 animate-pulse rounded-full bg-terra" aria-hidden />
              {t(LOADING_STAGE_KEYS[stage])}
            </p>
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
