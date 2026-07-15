"use client";
import { useEffect, useRef, useState } from "react";
import { Flame, ThumbsDown, ThumbsUp } from "lucide-react";
import { Card } from "@/components/student-ui";
import { useRouter } from "@/i18n/routing";
import type { Hotword, HotwordCategory, HotwordVote } from "@/types/hotwords";

// 今日热词 대시보드 카드 (docs/dashboard-features.md §2.2)
// · 오늘의 단어를 제시하되 뜻은 카드에서 다 밝히지 않는다(입장 후 AI가 알려줌).
// · 입장하기 → 워크스페이스 재사용(mode=hotword).
// · 좋았어요/비추 → 자동 큐레이션용(입장/학습과 별개로 공존).
// 라벨은 클라이언트 안전하게 로컬로 둔다(server-only lib/hotwords 를 import 하지 않음).
const CATEGORY_LABEL: Record<HotwordCategory, string> = {
  game: "게임",
  entertainment: "연예",
  society: "사회",
  economy: "경제",
  daily: "일상",
  meme: "밈",
};

const CATEGORY_TONE: Record<HotwordCategory, string> = {
  game: "bg-blue-soft text-blue-dark",
  entertainment: "bg-gem-soft text-gem-dark",
  society: "bg-jade-soft text-jade-dark",
  economy: "bg-gold-soft text-gold-dark",
  daily: "bg-blue-soft text-blue-dark",
  meme: "bg-terra-soft text-terra-dark",
};

export default function HotwordCard({ hotword }: { hotword: Hotword | null }) {
  const router = useRouter();
  const [voted, setVoted] = useState<HotwordVote | null>(null);
  const [busy, setBusy] = useState(false);
  const impressed = useRef(false);

  // 고유 노출 1회 집계(멱등) — like_rate 분모.
  useEffect(() => {
    if (!hotword || impressed.current) return;
    impressed.current = true;
    void fetch("/api/hotwords/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotwordId: hotword.id }),
    }).catch(() => {});
  }, [hotword]);

  if (!hotword) {
    return (
      <Card className="flex h-full flex-col p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl2 bg-terra-soft text-terra-dark">
            <Flame size={18} aria-hidden />
          </span>
          <div>
            <div className="font-bold text-ink">今日热词</div>
            <div className="text-[11px] text-muted">오늘 뜨는 중국어</div>
          </div>
        </div>
        <p className="mt-4 flex-1 text-sm text-muted">
          오늘의 신조어를 준비 중이에요. 곧 새 표현이 올라와요!
        </p>
      </Card>
    );
  }

  async function vote(v: HotwordVote) {
    if (busy || !hotword) return;
    setBusy(true);
    setVoted(v); // 낙관적 반영
    try {
      await fetch("/api/hotwords/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotwordId: hotword.id, vote: v }),
      });
    } catch {
      /* 큐레이션 신호는 실패해도 학습 흐름을 막지 않는다 */
    } finally {
      setBusy(false);
    }
  }

  function enter() {
    router.push(`/learn/1?mode=hotword&hotwordId=${hotword!.id}`);
  }

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl2 bg-terra-soft text-terra-dark">
          <Flame size={18} aria-hidden />
        </span>
        <div>
          <div className="font-bold text-ink">今日热词</div>
          <div className="text-[11px] text-muted">오늘 뜨는 중국어</div>
        </div>
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ${CATEGORY_TONE[hotword.category]}`}
        >
          {CATEGORY_LABEL[hotword.category]}
        </span>
        {/* 오늘의 단어 — 뜻은 밝히지 않고 궁금증만 남긴다. */}
        <p lang="zh" className="font-cn mt-2 text-2xl font-extrabold leading-tight text-ink">
          {hotword.term}
        </p>
        {hotword.pinyin && (
          <p className="mt-0.5 text-xs text-muted">{hotword.pinyin}</p>
        )}
      </div>

      <button
        type="button"
        onClick={enter}
        className="mt-4 w-full rounded-xl2 bg-ink py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
      >
        입장하기
      </button>

      {/* 좋았어요 / 비추 — 자동 큐레이션용(학습과 별개) */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => vote("like")}
          disabled={busy}
          aria-pressed={voted === "like"}
          aria-label="좋았어요"
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
            voted === "like"
              ? "bg-jade text-white"
              : "bg-ivory text-bodytx hover:bg-jade-soft"
          }`}
        >
          <ThumbsUp size={13} aria-hidden /> 좋았어요
        </button>
        <button
          type="button"
          onClick={() => vote("dislike")}
          disabled={busy}
          aria-pressed={voted === "dislike"}
          aria-label="비추"
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
            voted === "dislike"
              ? "bg-terra text-white"
              : "bg-ivory text-bodytx hover:bg-terra-soft"
          }`}
        >
          <ThumbsDown size={13} aria-hidden /> 비추
        </button>
      </div>
    </Card>
  );
}
