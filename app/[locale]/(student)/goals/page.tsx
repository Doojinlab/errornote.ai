import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { calcProgressForGoals } from "@/lib/goals";
import type { GoalProgress, LearningGoal } from "@/types/goals";
import GoalsManager from "./GoalsManager";

async function loadGoals(): Promise<{ goals: LearningGoal[]; progress: GoalProgress[] }> {
  const supabase = createServerClient();
  const user = await getCurrentUser();
  if (!user) return { goals: [], progress: [] };

  const { data } = await supabase
    .from("learning_goals")
    .select(
      "id, student_id, class_id, goal_type, target_value, current_value, deadline, is_achieved, achieved_at, created_at, updated_at"
    )
    .eq("student_id", user.id)
    .order("is_achieved", { ascending: true })
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const goals = (data as LearningGoal[] | null) ?? [];
  const progress = await calcProgressForGoals(supabase, user.id, goals);
  return { goals, progress };
}

export default async function GoalsPage() {
  const [t, { goals, progress }] = await Promise.all([
    getTranslations("pages.student.goals"),
    loadGoals(),
  ]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="text-xs text-muted">{t("countLabel", { count: goals.length })}</p>
      </div>
      <GoalsManager initialGoals={goals} initialProgress={progress} />
    </section>
  );
}
