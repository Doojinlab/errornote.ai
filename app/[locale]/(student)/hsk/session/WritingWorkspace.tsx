"use client";

import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import Card from "@/components/ui/Card";
import DocumentEditor from "@/components/learn/DocumentEditor";
import ErrorPanel from "@/components/learn/ErrorPanel";
import TutorChat from "@/components/learn/TutorChat";
import type { AnalysisResponse, AnalyzeRequest } from "@/types";
import type { HskQuestion } from "@/types/hsk";

// 쓰기 세션 — 작문 워크스페이스 임베드(피드백 반영).
// 상단에 题目, 좌측 에디터에서 바로 작성 → [AI 분석] → 오류카드. 우측 오류카드/AI 과외는
// 학생이 열고 닫는다(실전 집중). 모르는 단어는 AI 과외 채팅에서 바로 질문.

type Tab = "errors" | "chat";

export default function WritingWorkspace({
  question,
  classId,
  chapterId,
}: {
  question: HskQuestion;
  classId: string | null;
  chapterId: string;
}) {
  const chapterNumber = Number(chapterId) || 1;

  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");

  async function analyze() {
    if (!draft.trim() || analyzing) return;
    if (!classId) {
      setError("활성 수업이 없어 AI 분석을 사용할 수 없어요.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const body: Partial<AnalyzeRequest> = { classId, chapterNumber, draftText: draft };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as AnalysisResponse | { error?: string };
      if (!res.ok) throw new Error(("error" in json && json.error) || `분석 실패 (${res.status})`);
      setAnalysis(json as AnalysisResponse);
      setFocusedErrorId(null);
      setPanelOpen(true);
      setTab("errors");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했어요.");
    } finally {
      setAnalyzing(false);
    }
  }

  const focusedError = analysis?.errors.find((e) => e.id === focusedErrorId) ?? null;

  return (
    <div className="space-y-3">
      {/* 题目 — 항상 보임 */}
      <Card className="space-y-1.5 p-4">
        <p className="text-xs font-semibold text-blue-dark">작문 题目 · {question.type}</p>
        <p className="text-sm text-bodytx">{question.instructions}</p>
        <p lang="zh" className="whitespace-pre-wrap font-cn text-[15px] font-semibold leading-relaxed text-ink">
          {question.prompt}
        </p>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-pressed={panelOpen}
          aria-label={panelOpen ? "오류카드·AI 과외 닫기" : "오류카드·AI 과외 열기"}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-bodytx hover:bg-ivory"
        >
          {panelOpen ? <PanelRightClose size={14} aria-hidden /> : <PanelRightOpen size={14} aria-hidden />}
          {panelOpen ? "패널 닫기" : "오류카드·AI 과외 열기"}
        </button>
      </div>

      <div className={panelOpen ? "lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:gap-3" : ""}>
        {/* 에디터 — 고정 높이(내부 DocumentEditor 가 h-full 을 채움) */}
        <div>
          <div className="h-[460px] overflow-hidden rounded-xl2 border border-hairline bg-white">
            <DocumentEditor value={draft} onChange={setDraft} onSubmit={analyze} isSubmitting={analyzing} />
          </div>
          {error && <p className="mt-1.5 px-1 text-xs text-terra">{error}</p>}
        </div>

        {/* 오류카드 · AI 과외 (토글) */}
        {panelOpen && (
          <div className="mt-3 flex h-[460px] flex-col overflow-hidden rounded-xl2 border border-hairline bg-white lg:mt-0">
            <div className="grid grid-cols-2 border-b border-hairline" role="tablist" aria-label="오류카드·AI 과외">
              {(
                [
                  { id: "errors", label: "오류 카드" },
                  { id: "chat", label: "AI 과외" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-2.5 text-sm font-semibold transition-colors ${
                    tab === t.id ? "bg-terra-soft text-terra-dark" : "text-bodytx hover:bg-ivory"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {tab === "errors" ? (
                <ErrorPanel
                  analysis={analysis}
                  focusedErrorId={focusedErrorId}
                  onFocusError={setFocusedErrorId}
                  isLoading={analyzing}
                />
              ) : (
                <TutorChat focusedError={focusedError} chapterNumber={chapterNumber} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
