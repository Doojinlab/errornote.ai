import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import ToneDrillClient from "./ToneDrillClient";

// 중국어 성조 실측 연습 — 단음절 녹음 → 피치(F0) 곡선 분석 → 성조 판정.
// 실제 오디오 신호처리는 lib/tone-analysis.ts(순수·단위검증) + 클라이언트 오디오 캡처.
export default async function TonePracticePage() {
  const t = await getTranslations("pages.student.tonePractice");

  return (
    <section className="space-y-4">
      <div>
        <Link
          href="/pronunciation"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-bodytx"
        >
          <ArrowLeft size={14} aria-hidden />
          {t("back")}
        </Link>
        <h1 className="mt-1 text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>

      <ToneDrillClient />
    </section>
  );
}
