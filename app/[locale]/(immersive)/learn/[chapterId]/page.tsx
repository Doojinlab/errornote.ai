import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { parseHskEntryParams } from "@/lib/hsk";
import { getActiveHotwordById } from "@/lib/hotwords";
import type {
  HskEntryContext,
  HotwordEntryContext,
  WorkspaceEntryMode,
} from "@/types";
import LearnClient from "./LearnClient";

interface EnrollmentRow {
  class_id: string;
  classes: { is_active: boolean };
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * 입장 파라미터(?mode=hsk|hotword&...)를 안전한 입장 컨텍스트로 해석한다.
 * 유효하지 않으면 일반 워크스페이스로 폴백(엔트리 컨텍스트 없음).
 */
async function resolveEntry(sp: SearchParams): Promise<{
  entryMode?: WorkspaceEntryMode;
  hskContext?: HskEntryContext;
  hotwordContext?: HotwordEntryContext;
}> {
  const mode = first(sp.mode);

  if (mode === "hsk") {
    const hsk = parseHskEntryParams({
      level: first(sp.level),
      area: first(sp.area),
      hskMode: first(sp.hskMode),
    });
    if (hsk) return { entryMode: "hsk", hskContext: hsk };
    return {};
  }

  if (mode === "hotword") {
    const id = first(sp.hotwordId);
    if (!id) return {};
    const hw = await getActiveHotwordById(id);
    if (!hw) return {};
    return {
      entryMode: "hotword",
      hotwordContext: {
        term: hw.term,
        category: hw.category,
        pinyin: hw.pinyin ?? undefined,
        literal: hw.literal ?? undefined,
        meaning: hw.meaning ?? undefined,
        example: hw.example ?? undefined,
        origin: hw.origin ?? undefined,
        registerTag: hw.registerTag ?? undefined,
      },
    };
  }

  return {};
}

async function loadActiveClassId(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("enrollments")
    .select("class_id, classes!inner(is_active)")
    .eq("student_id", userId)
    .eq("classes.is_active", true)
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EnrollmentRow | null)?.class_id ?? null;
}

export default async function LearnPage(props: {
  params: Promise<{ chapterId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const t = await getTranslations("pages.student.learn");
  const user = await getCurrentUser();
  if (!user) return null;

  const classId = await loadActiveClassId(user.id);

  if (!classId) {
    return (
      <section className="mx-auto flex min-h-dvh max-w-md flex-1 flex-col items-center justify-center p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">{t("noActiveClassTitle")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("noActiveClassBody")}</p>
      </section>
    );
  }

  const entry = await resolveEntry(searchParams);

  return (
    <LearnClient
      classId={classId}
      chapterId={params.chapterId}
      entryMode={entry.entryMode}
      hskContext={entry.hskContext}
      hotwordContext={entry.hotwordContext}
    />
  );
}
