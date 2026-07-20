import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import VocabularyList, { type VocabItem } from "./VocabularyList";

async function loadVocab(): Promise<VocabItem[]> {
  const supabase = createServerClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("vocabulary")
    .select("id, chinese, pinyin, korean, review_count, next_review_at, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  return (data as VocabItem[] | null) ?? [];
}

export default async function VocabularyPage() {
  const [t, items] = await Promise.all([
    getTranslations("pages.student.vocabulary"),
    loadVocab(),
  ]);
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="text-xs text-muted">{t("countLabel", { count: items.length })}</p>
      </div>
      <VocabularyList items={items} />
    </section>
  );
}
