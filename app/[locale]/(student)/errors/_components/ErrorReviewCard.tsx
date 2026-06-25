import { Card } from "@/components/student-ui";
import { Check } from "lucide-react";

export interface ErrorItem {
  id: string;
  /** 오류 유형 라벨(어순/양사/시태 등) */
  category: string;
  /** 출처 표시(예: "3과") */
  chapter: string;
  /** 작성일(예: "06.21") */
  date: string;
  /** 원문: 오류 구간(mark)만 터라코타 취소선으로 마킹하기 위해 앞/오류/뒤로 분리 */
  before: { pre: string; mark: string; post: string };
  /** 교정문(전체) */
  after: string;
  /** 한국어 설명 */
  note: string;
}

/**
 * 오류 카드 1건. 스펙 §5: "터라코타 취소선 + jade 교정문".
 * - 터라코타(terra)는 중국어 원문의 오류 구간 마킹에만 사용(화면의 극히 일부 = 5% 규칙).
 * - 교정문은 jade. 중국어 문장만 font-cn + lang="zh", 설명은 한글 Pretendard.
 */
export default function ErrorReviewCard({ item }: { item: ErrorItem }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-bold text-blue-dark">
          {item.category}
        </span>
        <span className="text-xs text-muted">
          {item.chapter} · {item.date}
        </span>
      </div>

      {/* 원문 — 오류 구간만 터라코타 취소선 */}
      <p lang="zh" className="font-cn mt-3 text-lg leading-relaxed text-ink">
        {item.before.pre}
        <span className="text-terra line-through decoration-2">
          {item.before.mark}
        </span>
        {item.before.post}
      </p>

      {/* 교정문 — jade */}
      <p
        lang="zh"
        className="font-cn mt-1.5 flex items-start gap-1.5 text-lg leading-relaxed text-jade-dark"
      >
        <Check size={18} className="mt-1 shrink-0 text-jade" aria-hidden />
        <span>{item.after}</span>
      </p>

      <p className="mt-3 border-t border-hairline pt-3 text-sm text-bodytx">
        {item.note}
      </p>
    </Card>
  );
}
