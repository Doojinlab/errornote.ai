import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getOrCreateTodayQuest } from "@/lib/daily-quests";
import { processGraduations } from "@/lib/graduation";
import { getClassGoals, type ClassGoal } from "@/lib/class-goals";
import { listErrorSpecies } from "@/lib/error-dex";
import type { DailyQuest } from "@/types/daily-quests";
import QuestBoard from "./QuestBoard";

interface ClassGoalsView {
  goals: ClassGoal[];
  speciesName: Record<string, string>;
}

/** 학생이 수강 중인 첫 반의 협동 목표 + 종 이름 맵(읽기 전용 표시용). */
async function loadClassGoals(): Promise<ClassGoalsView | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("class_id")
      .eq("student_id", user.id)
      .limit(1)
      .maybeSingle();
    const classId = (enr as { class_id: string } | null)?.class_id;
    if (!classId) return null;
    const [goals, species] = await Promise.all([getClassGoals(classId), listErrorSpecies()]);
    if (goals.length === 0) return null;
    const speciesName: Record<string, string> = {};
    for (const s of species) speciesName[s.id] = s.name_ko;
    return { goals, speciesName };
  } catch {
    return null;
  }
}

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
  const [t, tc, quest, classGoals] = await Promise.all([
    getTranslations("pages.student.quests"),
    getTranslations("pages.student.classGoalsCard"),
    loadTodayQuest(),
    loadClassGoals(),
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

      {classGoals && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="mb-3 text-sm font-bold text-indigo-900">🤝 {tc("title")}</p>
          <ul className="space-y-3">
            {classGoals.goals.map((g) => {
              const pct = Math.min(100, Math.round((g.currentCount / g.targetCount) * 100));
              const name = g.title || classGoals.speciesName[g.speciesId] || tc("untitled");
              return (
                <li key={g.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className="tabular-nums text-slate-500">
                      {g.currentCount} / {g.targetCount}
                      {g.achieved ? ` · 🎉 ${tc("achieved")}` : ""}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${g.achieved ? "bg-emerald-500" : "bg-indigo-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-indigo-700/70">{tc("hint")}</p>
        </div>
      )}
    </section>
  );
}
