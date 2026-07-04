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
import { W } from "@/components/learn/writerTheme";
import type { AnalysisResponse, AnalyzeRequest } from "@/types";

type Tab = "doc" | "errors" | "chat";

interface Props {
  classId: string;
  chapterId: string;
}

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

  const errorCount = analysis?.error_count ?? null;
  const hskAvg =
    analysis && analysis.errors.length
      ? `${Math.round(
          analysis.errors.reduce((s, e) => s + (e.hsk_level ?? 0), 0) / analysis.errors.length
        )}급`
      : null;

  return (
    <div className="flex h-dvh flex-col" style={{ background: W.paper2 }}>
      {/* 데스크톱: 중앙 카드 / 모바일: 풀스크린 */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden lg:mx-auto lg:my-4 lg:w-full lg:max-w-7xl lg:rounded-2xl lg:border lg:shadow-sm"
        style={{ background: W.paper, borderColor: W.line }}
      >
        {/* 윈도우 크롬 */}
        <header
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ borderBottom: `1px solid ${W.line}`, background: W.paper2 }}
        >
          <Link
            href="/learn"
            aria-label="학습 홈으로"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
            style={{ color: W.inkMute }}
          >
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FF5F57" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28C840" }} />
          </div>
          <span className="text-xs font-medium" style={{ color: W.inkMute }}>
            errornote · 작문 연습
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-[11.5px]" style={{ color: W.inkMute }}>
            {error ? (
              <span role="alert" className="truncate font-medium" style={{ color: W.red }}>
                {error}
              </span>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: W.green }} />
                저장됨
              </>
            )}
          </div>
        </header>

        {/* 본문 — 데스크톱(lg): 좌 문서(2행 span) / 우 상 오류·하 채팅. 모바일: 단일 + 하단 탭 */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-2">
          {/* 좌 — 문서/분석 */}
          <section
            className={`${tab === "doc" ? "flex" : "hidden"} min-h-0 flex-col lg:col-start-1 lg:row-span-2 lg:flex`}
            style={{ borderRight: `1px solid ${W.line}` }}
          >
            {analysis ? (
              <div className="flex h-full min-h-0 flex-col" style={{ background: W.paper }}>
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: `1px solid ${W.line}` }}
                >
                  <span className="text-sm font-semibold" style={{ color: W.ink }}>
                    {t("analysisResult")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnalysis(null)}
                    className="text-xs font-medium hover:underline"
                    style={{ color: W.red }}
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
                <div
                  className="flex items-center gap-4 px-6 py-3 text-xs"
                  style={{ borderTop: `1px solid ${W.line}`, background: W.paper2, color: W.inkMute }}
                >
                  <span>
                    글자 <strong style={{ color: W.ink }}>{draft.trim().length}</strong>
                  </span>
                  <span>
                    오류{" "}
                    <strong style={{ color: (errorCount ?? 0) > 0 ? W.red : W.ink }}>
                      {errorCount ?? 0}
                    </strong>
                  </span>
                  <span>
                    HSK 평균 <strong style={{ color: W.ink }}>{hskAvg ?? "—"}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <DocumentEditor
                value={draft}
                onChange={setDraft}
                onSubmit={analyze}
                isSubmitting={analyzing}
                errorCount={errorCount}
                hskAvg={hskAvg}
              />
            )}
          </section>

          {/* 우상 — 오류 카드 */}
          <section
            className={`${tab === "errors" ? "flex" : "hidden"} min-h-0 flex-col lg:col-start-2 lg:row-start-1 lg:flex`}
            style={{ borderBottom: `1px solid ${W.line}` }}
          >
            <ErrorPanel
              analysis={analysis}
              focusedErrorId={focusedErrorId}
              onFocusError={setFocusedErrorId}
              isLoading={analyzing}
            />
          </section>
          {/* 우하 — 채팅 */}
          <section
            className={`${tab === "chat" ? "flex" : "hidden"} min-h-0 flex-col lg:col-start-2 lg:row-start-2 lg:flex`}
          >
            <TutorChat focusedError={focusedError} chapterNumber={chapterNumber} />
          </section>
        </div>
      </div>

      {/* 모바일 탭 */}
      <nav
        className="grid grid-cols-3 lg:hidden"
        role="tablist"
        aria-label={t("tabNavAria")}
        style={{ borderTop: `1px solid ${W.line}`, background: W.paper }}
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
            className="py-3 text-sm font-medium transition"
            style={
              tab === tab2.id
                ? { background: W.redSoft, color: W.redDeep }
                : { color: W.inkMute }
            }
          >
            {tab2.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
