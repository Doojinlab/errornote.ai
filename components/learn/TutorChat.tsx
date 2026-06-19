"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AnalysisError, ChatMessage, ChatRequest } from "@/types";
import type { TutorQuiz, AddToVocabInput } from "@/lib/tutor-tools";
import TutorQuizCard from "./TutorQuizCard";

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
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold text-slate-700">
        <span>{t("heading")}</span>
        {focusedError && (
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
            {t("contextLabel", { subtype: focusedError.error_subtype })}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-400">{t("emptyState")}</p>
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
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.content}
              </div>
            )}
            {m.artifacts?.map((a, ai) =>
              a.kind === "quiz" ? (
                <div key={ai} className="w-[90%]">
                  <TutorQuizCard quiz={a.quiz} />
                </div>
              ) : (
                <div
                  key={ai}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
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
        className="flex gap-2 border-t p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t("send")}
        </button>
      </form>
    </div>
  );
}
