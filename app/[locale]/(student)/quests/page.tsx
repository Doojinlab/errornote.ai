import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getOrCreateTodayQuest } from "@/lib/daily-quests";
import { processGraduations } from "@/lib/graduation";
import type { DailyQuest } from "@/types/daily-quests";
import QuestBoard from "./QuestBoard";

async function loadTodayQuest(): Promise<DailyQuest | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const quest = await getOrCreateTodayQuest(user.id);
    // 닫힘 루프: 데일리 진입 시 졸업 판정도 함께(비치명적).
    try {
      await processGraduations(user.id);
    } catch {
      /* 졸업 판정 실패는 퀘스트 표시를 막지 않는다 */
    }
    return quest;
  } catch {
    // 생성 실패(예: AI 호출 오류) 시 500 대신 빈 상태로 폴백.
    return null;
  }
}

export default async function QuestsPage() {
  const [t, quest] = await Promise.all([
    getTranslations("pages.student.quests"),
    loadTodayQuest(),
  ]);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>
      {quest && quest.missions.length > 0 ? (
        <QuestBoard initialMissions={quest.missions} />
      ) : (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          {t("empty")}
        </p>
      )}
    </section>
  );
}
