"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import DocumentEditor from "@/components/learn/DocumentEditor";
import AnnotatedText from "@/components/learn/AnnotatedText";
import ErrorPanel from "@/components/learn/ErrorPanel";
import TutorChat from "@/components/learn/TutorChat";
import { useSound } from "@/components/gamification/SoundManager";
import { fetchOrEnqueue, isQueuedSentinel } from "@/lib/offline-queue";
import type { AnalysisResponse, AnalyzeRequest } from "@/types";

type Tab = "doc" | "errors" | "chat";

interface Props {
  classId: string;
  chapterId: string;
}

// 각 패널 공통 — 데스크톱에서는 카드(둥근 테두리+그림자), 모바일에서는 풀블리드.
const PANE =
  "min-h-0 flex-1 flex-col overflow-hidden bg-white lg:flex lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm";

export default function LearnClient({ classId, chapterId }: Props) {
  const t = useTranslations("pages.student.learn");
  const chapterNumber = Number(chapterId);
  const { play } = useSound();
  const [tab, setTab] = useState<Tab>("doc");
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);
  // 한 번이라도 분석 결과를 받은 적이 있으면 다음 분석은 "수정고" 로 간주.
  // (오류 0개 수정고 → correct.mp3, errornote.md 559)
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);

  async function analyze() {
    if (!draft.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    const isRevision = hasSubmittedBefore;
    try {
      const body: Partial<AnalyzeRequest> = {
        classId,
        chapterNumber,
        draftText: draft,
      };
      const res = await fetchOrEnqueue(
        "/api/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        { kind: "analyze", label: `오류카드 — ${chapterId}과` }
      );
      if (isQueuedSentinel(res)) {
        // Network unreachable — request stashed in IDB; the global flusher
        // toast will tell the user. Bail out without setting analysis state.
        setError(t("offlineQueued"));
        return;
      }
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? t("analyzeFailedDefault");
        throw new Error(msg);
      }
      const data = (await res.json()) as AnalysisResponse;
      setAnalysis(data);
      setFocusedErrorId(null);
      setHasSubmittedBefore(true);

      const errorCount = data.errors?.length ?? 0;
      if (isRevision && errorCount === 0) {
        play("correct");
      } else if (errorCount > 0) {
        play("errorFound");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unknownError"));
    } finally {
      setAnalyzing(false);
    }
  }

  function focusError(id: number) {
    setFocusedErrorId(id);
    if (tab === "doc") setTab("errors");
  }

  const focusedError = analysis?.errors.find((e) => e.id === focusedErrorId) ?? null;

  return (
    <div className="flex h-dvh flex-col bg-slate-100">
      {/* 상단 바 — 학습 홈으로 돌아가기 + 챕터 라벨 */}
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link
          href="/learn"
          aria-label="학습 홈으로"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-sm font-semibold text-slate-700">
          {t("chapterLabel", { chapter: chapterId })}
        </h1>
        {error && (
          <p role="alert" className="ml-auto truncate text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </header>

      {/* 본문 — 데스크톱(lg): 좌 문서 / 우 상 오류·하 채팅 2열 분할. 모바일: 단일 + 하단 탭 */}
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-2 lg:gap-4 lg:p-4">
        {/* 문서 작성 / 분석 결과 */}
        <section
          className={`${tab === "doc" ? "flex" : "hidden"} ${PANE} lg:col-start-1 lg:row-span-2`}
        >
          {analysis ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 p-3">
                <h2 className="text-sm font-semibold text-slate-700">{t("analysisResult")}</h2>
                <button
                  type="button"
                  onClick={() => setAnalysis(null)}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  {t("editAgain")}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <AnnotatedText
                  annotatedText={analysis.annotated_text}
                  errors={analysis.errors}
                  focusedErrorId={focusedErrorId}
                  onErrorClick={focusError}
                />
              </div>
            </div>
          ) : (
            <DocumentEditor
              value={draft}
              onChange={setDraft}
              onSubmit={analyze}
              isSubmitting={analyzing}
            />
          )}
        </section>

        {/* 오류 카드 */}
        <section
          className={`${tab === "errors" ? "flex" : "hidden"} ${PANE} lg:col-start-2 lg:row-start-1`}
        >
          <ErrorPanel
            analysis={analysis}
            focusedErrorId={focusedErrorId}
            onFocusError={setFocusedErrorId}
            isLoading={analyzing}
          />
        </section>

        {/* AI 과외 채팅 */}
        <section
          className={`${tab === "chat" ? "flex" : "hidden"} ${PANE} lg:col-start-2 lg:row-start-2`}
        >
          <TutorChat focusedError={focusedError} chapterNumber={chapterNumber} />
        </section>
      </div>

      {/* 모바일 탭 — 데스크톱에서는 분할로 모두 보이므로 숨김 */}
      <nav
        className="grid grid-cols-3 border-t border-slate-200 bg-white lg:hidden"
        role="tablist"
        aria-label={t("tabNavAria")}
      >
        {(
          [
            { id: "doc", label: t("tabs.document") },
            { id: "errors", label: t("tabs.errors") },
            { id: "chat", label: t("tabs.chat") },
          ] as const
        ).map((tab2) => (
          <button
            key={tab2.id}
            type="button"
            role="tab"
            onClick={() => setTab(tab2.id)}
            aria-selected={tab === tab2.id}
            className={`py-3 text-sm font-medium transition-colors ${
              tab === tab2.id
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab2.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
