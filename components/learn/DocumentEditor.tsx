"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export default function DocumentEditor({ value, onChange, onSubmit, isSubmitting }: Props) {
  const t = useTranslations("pages.components.documentEditor");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  const canSubmit = !isSubmitting && !!value.trim();

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Ctrl/⌘ + Enter 로 분석 실행. 일반 Enter 는 줄바꿈(여러 문장 작성)으로 남겨둔다.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-semibold text-slate-700">{t("heading")}</h2>
        <div className="flex items-center gap-2">
          {/* AI 분석 — 주 액션(첫 분석 실행) */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={15} aria-hidden />
            {isSubmitting ? t("analyzing") : t("analyze")}
          </button>
          {/* 재진단 — 수정 후 다시 분석 */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("submit")}
          </button>
        </div>
      </div>

      {/* 입력 영역 — 비어 있을 때 안내 문구(placeholder)를 오버레이 */}
      <div className="relative min-h-0 flex-1">
        {!value && (
          <p className="pointer-events-none absolute left-4 top-4 text-base leading-7 text-slate-400">
            {t("placeholder")}
          </p>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText)}
          onKeyDown={handleKeyDown}
          className="h-full overflow-auto p-4 text-base leading-7 outline-none"
          aria-label={t("ariaLabel")}
        />
      </div>

      <div className="border-t px-4 py-2 text-right text-xs text-slate-400">
        {t("submitHint")}
      </div>
    </div>
  );
}
