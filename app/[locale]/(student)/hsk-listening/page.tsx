import { getTranslations } from "next-intl/server";
import { isHskLevel } from "@/lib/hsk";
import type { HskLevel } from "@/types";
import HskListeningClient from "./HskListeningClient";

// 실전 HSK 듣기(听力) — AI 대본 생성 + ElevenLabs TTS 재생 + 4지선다.
export default async function HskListeningPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const t = await getTranslations("pages.student.hskListening");
  const sp = await searchParams;
  const parsed = Number(sp.level);
  const initialLevel: HskLevel = isHskLevel(parsed) ? parsed : 4;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>

      <HskListeningClient initialLevel={initialLevel} />
    </section>
  );
}
