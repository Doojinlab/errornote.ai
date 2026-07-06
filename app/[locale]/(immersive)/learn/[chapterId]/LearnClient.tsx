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
  "min-h-0 flex-1 flex-col overflow-hidden bg-white lg:flex lg:rounded-xl2 lg:border lg:border-hairline lg:shadow-sm";

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

  // 상단 상태바용 통계 — 글자 수 / 오류 수 / HSK 평균
  const charCount = draft.length;
  const errorCount = analysis?.error_count ?? 0;
  const hskAvg =
    analysis && analysis.errors.length > 0
      ? Math.round(
          analysis.errors.reduce((sum, e) => sum + e.hsk_level, 0) / analysis.errors.length
        )
      : null;

  // 하단 진행 스텝퍼 — 타이핑 → 분석 → 하이라이트 → 오류 카드 → AI 솔루션
  const steps = [
    t("stepType"),
    t("stepAnalyze"),
    t("stepHighlight"),
    t("stepCards"),
    t("stepSolution"),
  ];
  const reached =
    focusedErrorId != null ? 5 : analysis ? 4 : draft.trim() || analyzing ? 2 : 1;

  return (
    <div className="flex h-dvh flex-col bg-ivory">
      {/* 상단 바 — 학습 홈으로 돌아가기 + 챕터 라벨 */}
      <header className="flex items-center gap-2 border-b border-hairline bg-white px-4 py-2.5">
        <Link
          href="/learn"
          aria-label="학습 홈으로"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-ivory hover:text-ink"
        >
          <ArrowLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-sm font-bold text-ink">
          {t("chapterLabel", { chapter: chapterId })}
        </h1>
        {error && (
          <p role="alert" className="ml-auto truncate text-xs font-medium text-terra-dark">
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
              <div className="flex items-center justify-between border-b border-hairline p-3">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  📄 {t("analysisResult")}
                </h2>
                <button
                  type="button"
                  onClick={() => setAnalysis(null)}
                  className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-bodytx transition-colors hover:bg-ivory"
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
              {/* 상태바 — 글자 / 오류 / HSK 평균 */}
              <div className="flex items-center gap-4 border-t border-hairline px-4 py-2 text-xs text-muted">
                <span>
                  {t("statChars")} <b className="font-semibold text-bodytx">{charCount}</b>
                </span>
                <span>
                  {t("statErrors")}{" "}
                  <b className={errorCount > 0 ? "font-semibold text-terra-dark" : "font-semibold text-jade"}>
                    {errorCount}
                  </b>
                </span>
                {hskAvg != null && (
                  <span>
                    {t("statHskAvg")}{" "}
                    <b className="font-semibold text-bodytx">{t("hskGrade", { level: hskAvg })}</b>
                  </span>
                )}
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

      {/* 진행 스텝퍼 — 데스크톱 전용(모바일은 하단 탭이 대신함) */}
      <nav
        className="hidden items-center justify-center gap-1 border-t border-hairline bg-white px-4 py-2.5 lg:flex"
        aria-label={t("tabNavAria")}
      >
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < reached;
          const active = n === reached;
          return (
            <div key={label} className="flex items-center">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-terra-soft text-terra-dark"
                    : done
                      ? "text-jade"
                      : "text-muted"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-terra text-white"
                      : done
                        ? "bg-jade text-white"
                        : "bg-hairline text-muted"
                  }`}
                >
                  {n}
                </span>
                {label}
              </span>
              {n < steps.length && <span className="mx-1 h-px w-4 bg-hairline" aria-hidden />}
            </div>
          );
        })}
      </nav>

      {/* 모바일 탭 — 데스크톱에서는 분할로 모두 보이므로 숨김 */}
      <nav
        className="grid grid-cols-3 border-t border-hairline bg-white lg:hidden"
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
                ? "bg-terra-soft text-terra-dark"
                : "text-bodytx hover:bg-ivory"
            }`}
          >
            {tab2.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
