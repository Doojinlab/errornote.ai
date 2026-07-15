"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";
import type { AnalysisError, ChatMessage, ChatRequest } from "@/types";
import type { TutorQuiz, AddToVocabInput } from "@/lib/tutor-tools";
import QuizModal from "./QuizModal";

interface Props {
  focusedError: AnalysisError | null;
  chapterNumber?: number;
}

/** 튜터 도구 산출물 — 채팅 말풍선에 인라인 렌더. */
type Artifact =
  | { kind: "quiz"; quiz: TutorQuiz }
  | { kind: "vocab"; vocab: AddToVocabInput };

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
}

/** NDJSON 스트림 이벤트(서버 lib/tutor-stream.ts 와 1:1). */
type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; tool: string; data: unknown }
  | { type: "done" }
  | { type: "error"; message: string };

export default function TutorChat({ focusedError, chapterNumber }: Props) {
  const t = useTranslations("pages.components.tutorChat");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // 연습 퀴즈는 좁은 채팅 창 대신 중앙 대형 모달로 푼다. 도착 시 자동으로 열리고,
  // 닫아도 채팅의 "풀기" 버튼으로 언제든 다시 열 수 있다.
  const [activeQuiz, setActiveQuiz] = useState<TutorQuiz | null>(null);

  /** 마지막(어시스턴트) 말풍선을 갱신. */
  function patchLast(fn: (m: UiMessage) => UiMessage) {
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }

  function applyEvent(ev: StreamEvent, accRef: { text: string }) {
    if (ev.type === "text") {
      accRef.text += ev.delta;
      const text = accRef.text;
      patchLast((m) => ({ ...m, content: text }));
    } else if (ev.type === "tool") {
      const artifact: Artifact | null =
        ev.tool === "generate_quiz"
          ? { kind: "quiz", quiz: ev.data as TutorQuiz }
          : ev.tool === "add_to_vocab"
            ? { kind: "vocab", vocab: ev.data as AddToVocabInput }
            : null;
      if (artifact) {
        patchLast((m) => ({ ...m, artifacts: [...(m.artifacts ?? []), artifact] }));
        // 퀴즈가 도착하면 곧바로 대형 모달을 띄운다.
        if (artifact.kind === "quiz") setActiveQuiz(artifact.quiz);
      }
    } else if (ev.type === "error") {
      patchLast((m) => ({
        ...m,
        content: m.content || t("errorFallback"),
      }));
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const history: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    const body: ChatRequest = {
      messages: history,
      errorContext: focusedError ?? undefined,
      chapterNumber,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      const accRef = { text: "" };
      let buffer = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const flushLines = (chunk: string, final = false) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = final ? "" : (lines.pop() ?? "");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            applyEvent(JSON.parse(trimmed) as StreamEvent, accRef);
          } catch {
            /* 부분 라인/파싱 실패는 무시(다음 청크에서 보강) */
          }
        }
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        flushLines(decoder.decode(value, { stream: true }));
      }
      flushLines("", true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("errorFallback") },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-ivory">
      <header className="flex items-center justify-between gap-2 border-b border-hairline bg-white px-4 py-3">
        <span className="text-sm font-bold text-ink">{t("heading")}</span>
        {focusedError && (
          <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-medium text-blue">
            {t("contextLabel", { subtype: focusedError.error_subtype })}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted">{t("emptyState")}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user" ? "flex justify-end" : "flex flex-col items-start"
            }
          >
            {(m.content || m.role === "user") && (
              <div
                className={`max-w-[85%] whitespace-pre-wrap px-3.5 py-2 text-sm leading-6 ${
                  m.role === "user"
                    ? "ml-auto rounded-2xl rounded-br-sm bg-ink text-white"
                    : "rounded-2xl rounded-bl-sm border border-hairline bg-white text-ink"
                }`}
              >
                {m.content}
              </div>
            )}
            {m.artifacts?.map((a, ai) =>
              a.kind === "quiz" ? (
                <button
                  key={ai}
                  type="button"
                  onClick={() => setActiveQuiz(a.quiz)}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue bg-blue-soft px-3.5 py-1.5 text-xs font-semibold text-blue-dark transition-colors hover:bg-blue-soft/70"
                >
                  🎯 {t("quizHeading")}
                  {a.quiz.topic ? ` · ${a.quiz.topic}` : ""} ·{" "}
                  {t("quizQuestionCount", { count: a.quiz.questions.length })} ·{" "}
                  {t("quizOpenCta")}
                </button>
              ) : (
                <div
                  key={ai}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-jade-soft px-3 py-1 text-xs font-medium text-jade-dark"
                >
                  📒 {t("vocabAdded", { word: a.vocab.chinese })}
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-hairline bg-white p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          className="flex-1 rounded-full border border-hairline bg-ivory px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-blue"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label={t("send")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
        >
          <ArrowUp size={18} aria-hidden />
        </button>
      </form>

      {activeQuiz && (
        <QuizModal
          quiz={activeQuiz}
          chapterNumber={chapterNumber}
          onClose={() => setActiveQuiz(null)}
        />
      )}
    </div>
  );
}
