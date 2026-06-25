import { Card } from "@/components/student-ui";
import { CheckCircle2, Target } from "lucide-react";

/**
 * 오류 화면 상단 요약 — 이번 주 "수정한 오류 개수"와 "정확도". 스펙 §5(오류/도구).
 * 색 규칙: 수정 개수=blue(일반 강조), 정확도=jade(교정/성공). terra 미사용.
 */
export default function WeeklySummary({
  fixed,
  accuracy,
}: {
  fixed: number;
  accuracy: number;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm font-bold text-ink">이번 주 복습</p>
      <p className="mt-0.5 text-xs text-muted">고친 오류가 쌓일수록 정확도가 올라가요.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl2 bg-blue-soft p-3">
          <div className="flex items-center gap-1.5 text-blue-dark">
            <CheckCircle2 size={16} aria-hidden />
            <span className="text-xs font-bold">수정한 오류</span>
          </div>
          <p className="mt-1 text-2xl font-extrabold text-blue-dark">
            {fixed}
            <span className="ml-0.5 text-sm font-bold">개</span>
          </p>
        </div>

        <div className="rounded-xl2 bg-jade-soft p-3">
          <div className="flex items-center gap-1.5 text-jade-dark">
            <Target size={16} aria-hidden />
            <span className="text-xs font-bold">정확도</span>
          </div>
          <p className="mt-1 text-2xl font-extrabold text-jade-dark">
            {accuracy}
            <span className="ml-0.5 text-sm font-bold">%</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
