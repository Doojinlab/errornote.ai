"use client";
import { useEffect, useRef } from "react";
import { FileText, Sparkles } from "lucide-react";
import { W } from "./writerTheme";

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  /** 하단 상태바 — 분석 결과가 있으면 오류 수/HSK 평균을 표시. */
  errorCount?: number | null;
  hskAvg?: string | null;
}

// 랜딩 데모(Demo3Pane) 좌측 "초고 작성" 패널과 같은 결로 리스킨.
export default function DocumentEditor({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  errorCount,
  hskAvg,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  const charCount = value.trim().length;

  return (
    <div className="flex h-full flex-col" style={{ background: W.paper }}>
      {/* 헤더: 제목 + AI 분석 버튼 */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${W.line}` }}
      >
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: W.inkMute }} aria-hidden />
          <span className="text-sm font-semibold" style={{ color: W.ink }}>
            초고 작성
          </span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition disabled:opacity-40"
          style={{
            background: W.red,
            boxShadow: isSubmitting ? `0 0 0 6px ${W.red}2e` : "none",
          }}
        >
          <Sparkles size={14} aria-hidden />
          {isSubmitting ? "분석 중…" : "AI 분석"}
        </button>
      </div>

      {/* 본문 에디터 */}
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText)}
          className="hanzi h-full min-h-full px-6 py-6 text-[18px] leading-[2] outline-none"
          style={{ color: W.ink }}
          aria-label="중국어 초고 입력"
        />
        {!value && (
          <p
            className="pointer-events-none absolute left-6 top-6 text-[18px] leading-[2]"
            style={{ color: W.inkFaint }}
          >
            여기에 중국어 문장을 작성한 뒤 <b style={{ color: W.red }}>AI 분석</b>을 눌러보세요.
          </p>
        )}
      </div>

      {/* 하단 상태바 */}
      <div
        className="flex items-center gap-4 px-6 py-3 text-xs"
        style={{
          borderTop: `1px solid ${W.line}`,
          background: W.paper2,
          color: W.inkMute,
        }}
      >
        <span>
          글자 <strong style={{ color: W.ink }}>{charCount}</strong>
        </span>
        <span>
          오류{" "}
          <strong style={{ color: (errorCount ?? 0) > 0 ? W.red : W.ink }}>
            {errorCount ?? 0}
          </strong>
        </span>
        <span>
          HSK 평균 <strong style={{ color: W.ink }}>{hskAvg ?? "—"}</strong>
        </span>
      </div>
    </div>
  );
}
