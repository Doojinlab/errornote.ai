"use client";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/student-ui";
import type { GradedReading } from "@/lib/graded-reading";

// 맞춤 그레이디드 리딩 (M12) — 내 약점 문법을 심은 짧은 지문 + 이해 문제.
export default function GradedReadingPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GradedReading | null>(null);
  const [weak, setWeak] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graded-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? "지문 생성에 실패했어요";
        throw new Error(msg);
      }
      const json = (await res.json()) as { reading: GradedReading; weakGrammar: string[] };
      setData(json.reading);
      setWeak(json.weakGrammar ?? []);
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
          <BookOpen size={20} className="text-gold-dark" aria-hidden />
          맞춤 리딩
        </h1>
        <p className="mt-0.5 text-xs text-muted">
          내가 자주 틀리는 문법을 살짝 심은 짧은 지문으로 연습해요.
        </p>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="w-full rounded-xl2 bg-ink py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "지문 만드는 중…" : data ? "새 지문 만들기" : "지문 만들기"}
      </button>

      {error && (
        <p role="alert" className="text-sm font-medium text-terra-dark">
          {error}
        </p>
      )}

      {data && (
        <>
          {weak.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {weak.map((w) => (
                <span
                  key={w}
                  className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[11px] font-bold text-gold-dark"
                >
                  {w}
                </span>
              ))}
            </div>
          )}

          <Card className="space-y-2 p-4">
            <h2 lang="zh" className="font-cn text-base font-bold text-ink">
              {data.title}
            </h2>
            <p lang="zh" className="font-cn text-base leading-loose text-bodytx">
              {data.text}
            </p>
          </Card>

          {data.glossary.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-[11px] font-bold text-muted">단어</div>
              <ul className="space-y-1.5">
                {data.glossary.map((g, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span lang="zh" className="font-cn font-bold text-ink">
                      {g.word}
                    </span>
                    <span className="text-xs text-muted">{g.pinyin}</span>
                    <span className="text-bodytx">{g.ko}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.questions.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-[11px] font-bold text-muted">이해 확인</div>
              <ol className="space-y-2.5">
                {data.questions.map((q, i) => (
                  <li key={i} className="text-sm">
                    <div lang="zh" className="font-cn text-ink">
                      {i + 1}. {q.q}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-blue">
                        정답 보기
                      </summary>
                      <div lang="zh" className="font-cn mt-1 text-jade-dark">
                        {q.answer}
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {data.targetGrammar.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-[11px] font-bold text-muted">이 지문에 담긴 문법</div>
              <ul className="space-y-2">
                {data.targetGrammar.map((g, i) => (
                  <li key={i} className="text-sm">
                    <div className="font-bold text-ink">{g.point}</div>
                    <div lang="zh" className="font-cn text-bodytx">
                      {g.example}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
