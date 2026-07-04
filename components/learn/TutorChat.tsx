"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, ArrowUp } from "lucide-react";
import type { AnalysisError, ChatMessage, ChatRequest } from "@/types";
import type { TutorQuiz, AddToVocabInput } from "@/lib/tutor-tools";
import TutorQuizCard from "./TutorQuizCard";
import { W } from "./writerTheme";

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
    <div className="flex h-full flex-col" style={{ background: W.paper2 }}>
      <header
        className="flex items-center gap-2 px-5 py-3 text-sm font-semibold"
        style={{ borderBottom: `1px solid ${W.line}`, color: W.ink }}
      >
        <Bot size={16} style={{ color: W.inkMute }} aria-hidden />
        <span>{t("heading")}</span>
        {focusedError && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: W.redSoft, color: W.redDeep }}
          >
            {t("contextLabel", { subtype: focusedError.error_subtype })}
          </span>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-center text-sm" style={{ color: W.inkFaint }}>
            {t("emptyState")}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"
            }
          >
            {(m.content || m.role === "user") && (
              <div
                className="max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                style={
                  m.role === "user"
                    ? { background: W.ink, color: W.paper }
                    : { background: W.paper, color: W.ink, border: `1px solid ${W.line}` }
                }
              >
                {m.content}
              </div>
            )}
            {m.artifacts?.map((a, ai) =>
              a.kind === "quiz" ? (
                <div key={ai} className="mt-2 w-[90%]">
                  <TutorQuizCard quiz={a.quiz} />
                </div>
              ) : (
                <div
                  key={ai}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
                  style={{ background: W.greenSoft, color: W.green }}
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
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderTop: `1px solid ${W.line}`, background: W.paper }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          className="min-w-0 flex-1 rounded-full px-4 py-2.5 text-[13px] outline-none"
          style={{ border: `1px solid ${W.line}`, background: W.paper, color: W.ink }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label={t("send")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
          style={{ background: W.ink }}
        >
          <ArrowUp size={18} aria-hidden />
        </button>
      </form>
    </div>
  );
}
