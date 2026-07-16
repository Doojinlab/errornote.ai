import { getTranslations } from "next-intl/server";
import GradedReadingClient from "./GradedReadingClient";

// 맞춤 그레이디드 리딩 페이지 (gamification-spec M12).
// lib/graded-reading.ts(generateGradedReading) → /api/graded-reading 로 연결되는 학생 진입점.
export default async function GradedReadingPage() {
  const t = await getTranslations("pages.student.gradedReading");

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>

      <GradedReadingClient />
    </section>
  );
}
