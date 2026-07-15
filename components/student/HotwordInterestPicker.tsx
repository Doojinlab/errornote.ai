"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/student-ui";
import type { HotwordCategory } from "@/types/hotwords";

// 今日热词 관심분야 선택 (docs/dashboard-features.md §2.1)
// 고른 분야로 오늘의 단어가 개인화된다. 미선택이면 전 분야에서 노출.
const CATEGORIES: { value: HotwordCategory; label: string }[] = [
  { value: "game", label: "게임" },
  { value: "entertainment", label: "연예" },
  { value: "society", label: "사회" },
  { value: "economy", label: "경제" },
  { value: "daily", label: "일상" },
  { value: "meme", label: "밈" },
];

export default function HotwordInterestPicker() {
  const [selected, setSelected] = useState<Set<HotwordCategory>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/hotwords/interests")
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: HotwordCategory[] }) => {
        if (alive) setSelected(new Set(d.categories ?? []));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(cat: HotwordCategory) {
    if (saving) return;
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setSelected(next);
    setSaving(true);
    try {
      await fetch("/api/hotwords/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: Array.from(next) }),
      });
    } catch {
      /* 저장 실패는 조용히 — 다음 토글에서 재시도 */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 text-left">
      <h2 className="text-base font-extrabold text-ink">今日热词 관심분야</h2>
      <p className="mt-1 text-sm leading-relaxed text-bodytx">
        고른 분야로 &lsquo;오늘의 단어&rsquo;가 맞춤 노출돼요. 안 고르면 전 분야에서 보여드려요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const on = selected.has(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggle(c.value)}
              disabled={loading || saving}
              aria-pressed={on}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ${
                on
                  ? "bg-terra text-white"
                  : "bg-ivory text-bodytx hover:bg-terra-soft"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
