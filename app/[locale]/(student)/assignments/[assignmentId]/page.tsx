import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getAssignment, getRubric } from "@/lib/assignments";
import SubmitClient from "./SubmitClient";
import type { RubricEvaluation } from "@/types/assignments";

interface MySessionRow {
  id: string;
  draft_text: string | null;
  draft_error_count: number | null;
  created_at: string;
}

export default async function StudentAssignmentPage(
  props: {
    params: Promise<{ assignmentId: string }>;
  }
) {
  const params = await props.params;
  const t = await getTranslations("pages.student.assignmentDetail");
  const supabase = createServerClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const assignment = await getAssignment(params.assignmentId);
  if (!assignment) notFound();

  // 성능: enrolled 확인 · 루브릭 · 본인 최신 제출은 서로 독립(모두 assignment/user 에만 의존)
  // 이라 한 번의 Promise.all 로 묶어 순차 왕복 2회를 없앤다. (rubric_evaluations 는 mySession.id
  // 에 의존하므로 그대로 뒤에 둔다.)
  const [enrollRes, rubric, mySessionRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("class_id")
      .eq("student_id", user.id)
      .eq("class_id", assignment.class_id)
      .maybeSingle(),
    assignment.rubric_id ? getRubric(assignment.rubric_id) : Promise.resolve(null),
    supabase
      .from("sessions")
      .select("id, draft_text, draft_error_count, created_at")
      .eq("assignment_id", assignment.id)
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!enrollRes.data) notFound(); // enrolled 수업 아님 (RLS 로도 막히지만 명시적으로)
  const mySession = (mySessionRes.data as MySessionRow | null) ?? null;

  let evaluation: RubricEvaluation | null = null;
  if (mySession) {
    const { data: ev } = await supabase
      .from("rubric_evaluations")
      .select("id, session_id, rubric_id, scores, total_score, ai_feedback, created_at")
      .eq("session_id", mySession.id)
      .maybeSingle();
    evaluation = (ev as RubricEvaluation | null) ?? null;
  }

  return (
    <main className="space-y-4">
      <div>
        <p className="text-xs text-muted">
          <Link href="/assignments" className="hover:underline">
            {t("breadcrumb")}
          </Link>{" "}
          › {assignment.title}
        </p>
        <h1 className="text-lg font-bold text-ink">{assignment.title}</h1>
        {assignment.due_date && (
          <p className="text-xs text-muted">
            {t("dueLabel", { date: new Date(assignment.due_date).toLocaleString() })}
          </p>
        )}
      </div>

      <SubmitClient
        assignment={assignment}
        rubric={rubric}
        initialDraft={mySession?.draft_text ?? ""}
        initialErrorCount={mySession?.draft_error_count ?? null}
        initialEvaluation={evaluation}
        alreadySubmitted={!!mySession}
      />
    </main>
  );
}
