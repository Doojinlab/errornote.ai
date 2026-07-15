import { getTranslations } from "next-intl/server";
import QuickAskClient from "./QuickAskClient";

// "이거 자연스러워?" 퀵애스크 페이지 (gamification-spec M10).
// lib/quick-ask.ts(askNaturalness) → /api/quick-ask 로 연결되는 학생 진입점.
export default async function QuickAskPage() {
  const t = await getTranslations("pages.student.quickAsk");

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>

      <QuickAskClient />
    </section>
  );
}
