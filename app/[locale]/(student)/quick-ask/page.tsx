"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/student-ui";
import type { NaturalnessResult, NaturalnessVerdict } from "@/lib/quick-ask";

// "이거 자연스러워?" 퀵애스크 (M10) — 문장 자연스러움 즉답.
const VERDICT: Record<NaturalnessVerdict, { label: string; cls: string }> = {
  natural: { label: "자연스러워요", cls: "bg-jade-soft text-jade-dark" },
  awkward: { label: "어색해요", cls: "bg-gold-soft text-gold-dark" },
  incorrect: { label: "틀렸어요", cls: "bg-terra-soft text-terra-dark" },
};

export default function QuickAskPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NaturalnessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    const t = text.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/naturalness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? "분석에 실패했어요";
        throw new Error(msg);
      }
      setResult((await res.json()) as NaturalnessResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <Sparkles size={20} className="text-jade" aria-hidden />
          이거 자연스러워?
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          중국어 문장이 자연스러운지 바로 확인해 드려요.
        </p>
      </div>

      <Card className="p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          lang="zh"
          placeholder="예: 我想要去图书馆学习"
          className="font-cn w-full resize-none rounded-xl2 border border-hairline bg-ivory p-3 text-base text-ink outline-none placeholder:text-muted focus:border-jade"
        />
        <button
          type="button"
          onClick={check}
          disabled={loading || !text.trim()}
          className="mt-3 w-full rounded-xl2 bg-ink py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "확인 중…" : "확인"}
        </button>
      </Card>

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-dark">
          {error}
        </p>
      )}

      {result && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${VERDICT[result.verdict].cls}`}
            >
              {VERDICT[result.verdict].label}
            </span>
            <span className="text-sm font-bold text-ink">{result.score}점</span>
          </div>
          {result.suggestion && result.suggestion !== text.trim() && (
            <div>
              <div className="text-[11px] font-bold text-muted">더 자연스럽게</div>
              <p lang="zh" className="font-cn mt-1 text-base text-jade-dark">
                {result.suggestion}
              </p>
            </div>
          )}
          {result.note && (
            <p className="text-sm leading-relaxed text-bodytx">{result.note}</p>
          )}
        </Card>
      )}
    </section>
  );
}
