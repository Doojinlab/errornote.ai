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

// 어순배열 채점 정규화 — 한자(Han)만 추출해 순서를 비교한다. 문장부호·공백·라벨(한국어/영문)을
// 무시하고 "제공 어절의 배열 순서"만 본다(제공 어절 내부 문법은 절대 교정하지 않는다).
function hanOnly(s: string): string {
  return (s.match(/\p{Script=Han}/gu) ?? []).join("");
}

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
  // 어순배열: 제공된 단어의 "순서"만 채점한다(자유작문 문법 분석기를 쓰지 않는다).
  const isArrangement = question.type.includes("어순배열");

  const [draft, setDraft] = useState("");
  const [arrangeResult, setArrangeResult] = useState<{ status: "correct" | "wrong" | "nokey" } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");

  async function analyze() {
    if (!draft.trim() || analyzing) return;

    // 어순배열 — 자유작문 분석기(/api/analyze)를 쓰지 않는다. 제공 어절은 고정·정답이라
    // 문법 교정 대상이 아니며(제공 단어를 오류로 표시하면 안 됨), 정답 문장과 "순서"만 대조한다.
    // 오류카드·화석화·리그 적재도 없고, 활성 수업도 불필요하다.
    if (isArrangement) {
      const key = hanOnly(question.answer ?? "");
      const status = key.length === 0 ? "nokey" : hanOnly(draft) === key ? "correct" : "wrong";
      setArrangeResult({ status });
      setError(null);
      setPanelOpen(true);
      setTab("errors");
      return;
    }

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
                  { id: "errors", label: isArrangement ? "채점" : "오류 카드" },
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
                isArrangement ? (
                  <ArrangeResult result={arrangeResult} answer={question.answer ?? ""} />
                ) : (
                  <ErrorPanel
                    analysis={analysis}
                    focusedErrorId={focusedErrorId}
                    onFocusError={setFocusedErrorId}
                    isLoading={analyzing}
                  />
                )
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

// 어순배열 채점 결과 — 제공 어절의 "순서"만 판정한다(제공 단어 자체는 오류로 다루지 않는다).
function ArrangeResult({
  result,
  answer,
}: {
  result: { status: "correct" | "wrong" | "nokey" } | null;
  answer: string;
}) {
  if (!result) {
    return (
      <div className="p-4">
        <p className="text-sm leading-relaxed text-muted">
          단어를 순서대로 배열해 문장을 입력하고 <span className="font-semibold text-bodytx">「AI 분석」</span> 을
          누르면 어순을 채점해요. 제공된 단어는 고치지 않고 <span className="font-semibold text-bodytx">순서만</span>{" "}
          확인합니다.
        </p>
      </div>
    );
  }
  if (result.status === "correct") {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-jade/30 bg-jade-soft p-3">
          <p className="text-sm font-bold text-jade-dark">정답이에요! 어순이 맞아요 ✅</p>
        </div>
      </div>
    );
  }
  if (result.status === "nokey") {
    return (
      <div className="p-4">
        <p className="text-sm leading-relaxed text-muted">
          이 문제는 자동 채점 정답 정보가 없어요. <span className="font-semibold text-bodytx">「AI 과외」</span> 탭에서
          어순을 확인해 보세요.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2 p-4">
      <div className="rounded-lg border border-terra/30 bg-terra-soft p-3">
        <p className="text-sm font-bold text-terra-dark">순서가 달라요. 다시 배열해 보세요.</p>
      </div>
      {answer && (
        <div className="rounded-lg border border-hairline bg-white p-3">
          <p className="text-[11px] font-semibold text-muted">정답</p>
          <p lang="zh" className="mt-0.5 font-cn text-sm text-ink">
            {answer}
          </p>
        </div>
      )}
      <p className="px-1 text-[11px] text-muted">이유가 궁금하면 「AI 과외」 탭에서 물어보세요.</p>
    </div>
  );
}
