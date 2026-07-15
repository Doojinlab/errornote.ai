import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import Card from "@/components/ui/Card";
import AnalyzeUrlClient from "./AnalyzeUrlClient";
import type { UrlAnalysisRecord, UrlAnalysisResult } from "@/types/url-analysis";

interface ListRow {
  id: string;
  url: string;
  source_type: UrlAnalysisRecord["source_type"];
  content_text: string | null;
  analysis_result: unknown;
  created_at: string;
}

async function loadHistory(studentId: string): Promise<UrlAnalysisRecord[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("url_analysis_logs")
    .select("id, url, source_type, content_text, analysis_result, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data as ListRow[] | null) ?? [];
  return rows.map((r) => ({
    id: r.id,
    student_id: studentId,
    url: r.url,
    source_type: r.source_type,
    content_text: r.content_text,
    analysis_result: (r.analysis_result as UrlAnalysisResult) ?? {
      overall_register: "",
      study_points: [],
      estimated_hsk_level: null,
      annotations: [],
      internet_slang: [],
    },
    created_at: r.created_at,
  }));
}

export default async function AnalyzeUrlPage() {
  const t = await getTranslations("pages.student.urlAnalyze");
  const user = await getCurrentUser();
  const history = user ? await loadHistory(user.id) : [];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>

      <AnalyzeUrlClient />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-bodytx">{t("historyTitle")}</h2>
        {history.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">{t("emptyState")}</Card>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id}>
                <Card className="p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs font-medium text-blue hover:underline"
                    >
                      {r.url}
                    </a>
                    <span className="shrink-0 rounded bg-ivory px-2 py-0.5 text-[10px] text-bodytx">
                      {t(`source.${r.source_type ?? "other"}`)}
                    </span>
                  </div>
                  {r.analysis_result.overall_register && (
                    <p className="mt-1 text-xs text-bodytx">
                      {r.analysis_result.overall_register}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted">
                    {new Date(r.created_at).toLocaleString()}
                    {" · "}
                    {t("annotationsCount", {
                      count:
                        r.analysis_result.annotations.length +
                        r.analysis_result.internet_slang.length,
                    })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
