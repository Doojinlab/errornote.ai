import { AlertCircle } from "lucide-react";
import { LipButton } from "@/components/student-ui";
import { loadErrorsData } from "@/lib/student-dashboard";
import WeeklySummary from "./_components/WeeklySummary";
import ErrorReviewCard from "./_components/ErrorReviewCard";

// 오류 기록 — 주간 요약(수정 개수·정확도) + 오류 카드 목록(스펙 §5).
// 데이터: error_cards(student_id 본인). 셸은 (student)/layout.tsx 제공.
export default async function ErrorsPage() {
  const data = await loadErrorsData();

  if (!data || data.items.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-extrabold text-ink">오류 기록</h1>
        <div className="flex flex-col items-center gap-3 rounded-xl3 border border-dashed border-hairline bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-soft text-blue-dark">
            <AlertCircle size={22} aria-hidden />
          </span>
          <p className="text-sm font-bold text-ink">아직 기록된 오류가 없어요</p>
          <p className="text-xs text-muted">
            글을 제출하면 AI가 찾은 오답카드가 여기에 모여요.
          </p>
          <LipButton href="/learn">학습 시작하기</LipButton>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-extrabold text-ink">오류 기록</h1>
        <p className="text-xs text-muted">최근 {data.items.length}건</p>
      </div>

      <WeeklySummary fixed={data.fixed} accuracy={data.accuracy} />

      <div className="space-y-3">
        {data.items.map((item) => (
          <ErrorReviewCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
