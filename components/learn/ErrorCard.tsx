"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight } from "lucide-react";
import type { AnalysisError } from "@/types";

interface Props {
  error: AnalysisError;
  errorCardId?: string;
  fossilizationCount?: number;
  isFocused?: boolean;
  onFocus?: () => void;
  onBookmark?: (errorCardId: string) => void | Promise<void>;
  onAddVocab?: (errorCardId: string) => void | Promise<void>;
  isBookmarked?: boolean;
  isInVocab?: boolean;
}

export default function ErrorCard({
  error,
  errorCardId,
  fossilizationCount,
  isFocused,
  onFocus,
  onBookmark,
  onAddVocab,
  isBookmarked,
  isInVocab,
}: Props) {
  const t = useTranslations("pages.components.errorCard");
  const [cotOpen, setCotOpen] = useState(false);
  const count = fossilizationCount ?? 0;
  const isFossilized = count >= 3;
  const isVocab = error.error_type === "vocab";
  const showActions = Boolean(errorCardId && (onBookmark || onAddVocab));

  return (
    <article
      onClick={onFocus}
      className={`cursor-pointer rounded-xl2 border bg-white p-4 shadow-sm transition ${
        isFocused ? "border-terra ring-2 ring-terra-soft" : "border-hairline hover:border-stone-300"
      }`}
    >
      {/* 뱃지 행 — 오류 유형 / HSK / 화석화 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isVocab ? "bg-blue-soft text-blue" : "bg-terra-soft text-terra-dark"
          }`}
        >
          {error.error_subtype}
        </span>
        <span className="rounded-full bg-hairline px-2.5 py-0.5 text-xs font-medium text-muted">
          {t("hskLevel", { level: error.hsk_level })}
        </span>
        {isFossilized && (
          <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold-dark">
            {t("fossilBadge", { count })}
          </span>
        )}
      </div>

      {/* 오류 범위 */}
      <div className="mt-3">
        <p className="text-xs font-medium text-muted">{t("fieldErrorSpan")}</p>
        <p className="mt-0.5 font-cn text-base font-semibold text-ink">{error.error_span}</p>
      </div>

      {/* 수정안 */}
      <div className="mt-2.5">
        <p className="text-xs font-medium text-muted">{t("fieldCorrection")}</p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 font-cn text-base font-semibold text-jade">
          {error.correction}
          <Check size={15} aria-hidden />
        </p>
      </div>

      {/* 설명 */}
      <div className="mt-2.5">
        <p className="text-xs font-medium text-muted">{t("fieldExplanation")}</p>
        <p className="mt-0.5 text-sm leading-6 text-bodytx">{error.explanation}</p>
      </div>

      {/* CoT 추론 단계 */}
      <div className="mt-3 border-t border-hairline pt-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCotOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue transition-colors hover:text-blue-dark"
          aria-expanded={cotOpen}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${cotOpen ? "rotate-90" : ""}`}
            aria-hidden
          />
          {cotOpen ? t("cotCollapse") : t("cotExpand", { count: error.cot_reasoning.length })}
        </button>
        {cotOpen && (
          <ol className="mt-2 space-y-2">
            {error.cot_reasoning.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-soft text-[11px] font-bold text-blue">
                  {i + 1}
                </span>
                <div className="leading-6">
                  <span className="font-semibold text-ink">{step.step}</span>
                  <span className="ml-1 text-bodytx">{step.content}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {error.similar_example && (
        <div className="mt-3 rounded-lg bg-ivory px-3 py-2 text-xs text-bodytx">
          <span className="font-medium text-muted">{t("similarExample")}</span>
          <span className="ml-2 font-cn text-ink">{error.similar_example}</span>
        </div>
      )}

      {showActions && errorCardId && (
        <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
          {onBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBookmark(errorCardId);
              }}
              disabled={isBookmarked}
              className="rounded-md border border-hairline px-2.5 py-1 text-xs font-medium text-bodytx hover:bg-ivory disabled:opacity-50"
            >
              {isBookmarked ? t("bookmarked") : t("bookmark")}
            </button>
          )}
          {onAddVocab && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddVocab(errorCardId);
              }}
              disabled={isInVocab}
              className="rounded-md border border-hairline px-2.5 py-1 text-xs font-medium text-bodytx hover:bg-ivory disabled:opacity-50"
            >
              {isInVocab ? t("vocabAdded") : t("vocabAdd")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
