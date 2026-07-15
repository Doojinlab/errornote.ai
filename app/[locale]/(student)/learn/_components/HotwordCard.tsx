"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Flame, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import type { Hotword, HotwordCategory, HotwordVote } from "@/types/hotwords";

// 今日热词 대시보드 카드 (docs/dashboard-features.md §2.2 · errornote-dashboard-reference.html)
// 오늘의 단어 제시(뜻은 입장 후 공개) + 입장하기 + 좋았어요/비추(자동 큐레이션).
// 라벨은 클라이언트 안전하게 로컬로 둔다(server-only lib/hotwords 미import).
const CATEGORY_LABEL: Record<HotwordCategory, string> = {
  game: "게임",
  entertainment: "연예",
  society: "사회",
  economy: "경제",
  daily: "일상",
  meme: "밈",
};

const voteBtn =
  "flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/50 focus-visible:ring-offset-1";

function Header({ category }: { category?: HotwordCategory }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Flame size={20} className="text-terra" aria-hidden />
        <span className="font-cn text-[17px] font-semibold text-terra-dark">
          今日热词
        </span>
        {category && (
          <span className="ml-auto rounded-full bg-terra-soft px-2.5 py-1 text-[11px] font-bold text-terra-dark">
            {CATEGORY_LABEL[category]}
          </span>
        )}
      </div>
      <div className="h-[3px] bg-terra" aria-hidden />
    </>
  );
}

export default function HotwordCard({
  hotword,
  chapterId = 1,
}: {
  hotword: Hotword | null;
  chapterId?: number | string;
}) {
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
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl2 border border-terra bg-white">
        <Header />
        <div className="flex flex-1 flex-col bg-ivory p-4">
          <p className="text-sm text-muted">
            오늘의 신조어를 준비 중이에요. 곧 새 표현이 올라와요!
          </p>
        </div>
      </div>
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
    router.push(`/learn/${chapterId}?mode=hotword&hotwordId=${hotword!.id}`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl2 border border-terra bg-white">
      <Header category={hotword.category} />

      <div className="flex flex-1 flex-col gap-3.5 bg-ivory p-4">
        <div className="text-[11px] font-semibold text-muted">오늘 뜨는 표현</div>

        <div className="grid grid-cols-2 items-stretch gap-3">
          {/* 단어 타일 — 뜻은 밝히지 않고 궁금증만 남긴다. */}
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl2 border border-hairline bg-white px-3 py-5">
            <div
              lang="zh"
              className="font-cn text-center text-2xl font-semibold leading-tight text-terra"
            >
              {hotword.term}
            </div>
            <div className="text-center text-[11px] text-muted">
              입장하면 뜻풀이 · 문장 만들기
            </div>
          </div>

          {/* 좋았어요 / 비추 — 자동 큐레이션용(학습과 별개) */}
          <div className="flex flex-col justify-center gap-2">
            <button
              type="button"
              onClick={() => vote("like")}
              disabled={busy}
              aria-pressed={voted === "like"}
              aria-label="좋았어요"
              className={`${voteBtn} ${
                voted === "like"
                  ? "bg-jade text-white"
                  : "bg-white text-jade-dark border border-jade/30 hover:bg-jade-soft"
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
              className={`${voteBtn} ${
                voted === "dislike"
                  ? "bg-terra text-white"
                  : "bg-white text-terra-dark border border-terra/30 hover:bg-terra-soft"
              }`}
            >
              <ThumbsDown size={13} aria-hidden /> 비추
            </button>
          </div>
        </div>

        {/* 입장하기 */}
        <button
          type="button"
          onClick={enter}
          className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-terra bg-gradient-to-b from-white to-terra-soft text-sm font-semibold text-terra transition-transform hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
        >
          입장하기
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
