"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Flame,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { pinyinToneParts, toneTextClass } from "@/lib/pinyin-tone";
import type { Hotword, HotwordVote } from "@/types/hotwords";
import type { CustomHotword } from "@/lib/hotword-custom";

// 今日热词 대시보드 카드 (docs/dashboard-features.md §2 · B 개편).
// 카테고리 선택기(B-1) + 한자·병음(성조색)·뜻(B-2) + 새로고침·스피커(B-4) +
// 좋았어요/비추(자동 큐레이션) + 입장(문장으로 표현). card-pop hover 는 내부 요소만(바깥 큰 카드는 제외 — 정신없음) + a11y(E).

// UI 카테고리 → DB enum 리맵(시사=society, 문화=daily). custom 은 즉석 생성.
const UI_CATEGORIES = [
  { key: "society", label: "시사" },
  { key: "economy", label: "경제" },
  { key: "entertainment", label: "연예" },
  { key: "daily", label: "문화" },
  { key: "game", label: "게임" },
  { key: "meme", label: "밈" },
  { key: "custom", label: "직접 입력" },
] as const;
type UiCategoryKey = (typeof UI_CATEGORIES)[number]["key"];
type EnumCategory = Exclude<UiCategoryKey, "custom">;

function labelOf(key: UiCategoryKey): string {
  return UI_CATEGORIES.find((c) => c.key === key)?.label ?? "밈";
}

interface DisplayWord {
  id: string | null; // 풀 단어면 id, 직접입력이면 null
  term: string;
  pinyin: string;
  meaning: string;
  example: string;
  categoryKey: UiCategoryKey;
}

function fromHotword(h: Hotword): DisplayWord {
  return {
    id: h.id,
    term: h.term,
    pinyin: h.pinyin ?? "",
    meaning: h.meaning ?? "",
    example: h.example ?? "",
    categoryKey: h.category,
  };
}
function fromCustom(c: CustomHotword): DisplayWord {
  return { id: null, term: c.term, pinyin: c.pinyin, meaning: c.meaning, example: c.example, categoryKey: "custom" };
}

const voteBtn =
  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/50 focus-visible:ring-offset-1";
const iconBtn =
  "flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-white text-bodytx transition-colors hover:bg-terra-soft hover:text-terra-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/50";

export default function HotwordCard({
  hotword,
  chapterId = 1,
}: {
  hotword: Hotword | null;
  chapterId?: number | string;
}) {
  const router = useRouter();

  const [word, setWord] = useState<DisplayWord | null>(hotword ? fromHotword(hotword) : null);
  const [uiCategory, setUiCategory] = useState<UiCategoryKey>(hotword?.category ?? "society");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const [lastTopic, setLastTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState<HotwordVote | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const seenIds = useRef<string[]>(hotword ? [hotword.id] : []);
  const impressed = useRef<Set<string>>(new Set());
  const speakUrlRef = useRef<string | null>(null);

  // 발음 재생 — ElevenLabs(서버 /api/tts). 한글은 서버에서 걸러 중국어만 읽는다.
  // voice:'bright' → 서버가 밝은 하이톤 풀에서 랜덤으로 골라 합성한다.
  // 새로고침(단어 로드)·재생 때마다 다양한 밝은 음성이 나온다(고정 X).
  async function speak(text: string) {
    if (speaking) return;
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "bright" }),
      });
      if (!res.ok) return; // 미설정(503) 등은 조용히 무시
      const blob = await res.blob();
      if (speakUrlRef.current) URL.revokeObjectURL(speakUrlRef.current);
      const url = URL.createObjectURL(blob);
      speakUrlRef.current = url;
      await new Audio(url).play();
    } catch {
      /* 재생 실패는 학습 흐름을 막지 않는다 */
    } finally {
      setSpeaking(false);
    }
  }

  useEffect(() => {
    return () => {
      if (speakUrlRef.current) URL.revokeObjectURL(speakUrlRef.current);
    };
  }, []);

  // 고유 노출 집계 — 풀 단어가 바뀔 때마다 1회(멱등).
  useEffect(() => {
    const id = word?.id;
    if (!id || impressed.current.has(id)) return;
    impressed.current.add(id);
    void fetch("/api/hotwords/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotwordId: id }),
    }).catch(() => {});
  }, [word?.id]);

  async function loadCategory(cat: EnumCategory, exclude: string[]) {
    setLoading(true);
    setError(null);
    setVoted(null);
    try {
      const res = await fetch(
        `/api/hotwords/by-category?category=${cat}&exclude=${encodeURIComponent(exclude.join(","))}`,
      );
      const json = (await res.json()) as { hotword: Hotword | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "조회 실패");
      if (!json.hotword) {
        setError("이 카테고리에 준비된 단어가 아직 없어요.");
        return;
      }
      seenIds.current.push(json.hotword.id);
      setWord(fromHotword(json.hotword));
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }

  async function loadCustom(topic: string) {
    const t = topic.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setVoted(null);
    setLastTopic(t);
    try {
      const res = await fetch("/api/hotwords/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const json = (await res.json()) as { hotword: CustomHotword; error?: string };
      if (!res.ok) throw new Error(json.error ?? "생성 실패");
      setWord(fromCustom(json.hotword));
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(key: UiCategoryKey) {
    setUiCategory(key);
    setPickerOpen(false);
    if (key === "custom") {
      // 직접입력은 아래 입력창을 노출(즉시 생성 X).
      setWord(null);
      return;
    }
    seenIds.current = [];
    void loadCategory(key, []);
  }

  function refresh() {
    if (!word) return;
    if (word.categoryKey === "custom") {
      if (lastTopic) void loadCustom(lastTopic);
      return;
    }
    void loadCategory(word.categoryKey as EnumCategory, seenIds.current);
  }

  async function vote(v: HotwordVote) {
    if (busy || !word?.id) return;
    setBusy(true);
    setVoted(v);
    try {
      await fetch("/api/hotwords/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotwordId: word.id, vote: v }),
      });
    } catch {
      /* 큐레이션 신호 실패는 학습을 막지 않는다 */
    } finally {
      setBusy(false);
    }
  }

  function enter() {
    if (!word) return;
    if (word.id) {
      router.push(`/learn/${chapterId}?mode=hotword&hotwordId=${word.id}`);
      return;
    }
    const q = new URLSearchParams({
      mode: "hotword",
      term: word.term,
      category: "custom",
    });
    if (word.pinyin) q.set("pinyin", word.pinyin);
    if (word.meaning) q.set("meaning", word.meaning);
    if (word.example) q.set("example", word.example);
    router.push(`/learn/${chapterId}?${q.toString()}`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl2 border border-terra bg-white">
      {/* 헤더 — 카테고리 칩(클릭 시 선택기 토글) */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Flame size={20} className="text-terra" aria-hidden />
        <span className="font-cn text-[17px] font-semibold text-terra-dark">今日热词</span>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          aria-label={`카테고리 선택 (현재 ${labelOf(uiCategory)})`}
          className="card-pop ml-auto inline-flex items-center gap-1 rounded-full bg-terra-soft px-2.5 py-1 text-[11px] font-bold text-terra-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/50"
        >
          {labelOf(uiCategory)}
          <ChevronDown size={12} aria-hidden className={pickerOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>
      <div className="h-[3px] bg-terra" aria-hidden />

      <div className="flex flex-1 flex-col gap-3.5 bg-ivory p-4">
        {/* 카테고리 선택기 */}
        {pickerOpen && (
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="카테고리">
            {UI_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => selectCategory(c.key)}
                aria-pressed={uiCategory === c.key}
                className={`card-pop rounded-lg py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/50 ${
                  uiCategory === c.key
                    ? "bg-terra text-white"
                    : "border border-terra/25 bg-white text-terra-dark hover:bg-terra-soft"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* 직접입력 입력창 */}
        {uiCategory === "custom" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadCustom(customTopic);
            }}
            className="flex gap-2"
          >
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value.slice(0, 40))}
              placeholder="관심 주제 (예: 축구, K-POP)"
              aria-label="관심 주제 입력"
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-terra focus:outline-none focus:ring-1 focus:ring-terra"
            />
            <button
              type="submit"
              disabled={loading || !customTopic.trim()}
              className="shrink-0 rounded-lg bg-terra px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              생성
            </button>
          </form>
        )}

        <div className="text-[11px] font-semibold text-muted">오늘 뜨는 표현</div>

        {/* 단어 타일 — 한자 + 병음(성조색) + 뜻 (B-2) */}
        <div className="card-pop rounded-xl2 border border-hairline bg-white px-3 py-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2" aria-busy="true">
              <div className="h-8 w-24 animate-pulse rounded bg-terra-soft" />
              <div className="h-3 w-32 animate-pulse rounded bg-hairline" />
              <div className="h-3 w-40 animate-pulse rounded bg-hairline" />
            </div>
          ) : word ? (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex items-center gap-2">
                <span lang="zh" className="font-cn text-2xl font-semibold leading-tight text-terra">
                  {word.term}
                </span>
                <button
                  type="button"
                  onClick={() => speak(word.term)}
                  disabled={speaking}
                  aria-label={`단어 ${word.term} 발음 듣기`}
                  title="단어 발음 듣기"
                  className={`${iconBtn} disabled:opacity-50`}
                >
                  <Volume2 size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading}
                  aria-label="다른 단어 보기"
                  title="새로고침"
                  className={iconBtn}
                >
                  <RefreshCw size={15} aria-hidden />
                </button>
              </div>
              {word.pinyin && (
                <div lang="zh" className="font-cn text-sm">
                  {pinyinToneParts(word.pinyin).map((p, i) => (
                    <span key={i} className={toneTextClass(p.tone)}>
                      {p.text}
                    </span>
                  ))}
                </div>
              )}
              {word.meaning && <div className="text-sm font-medium text-bodytx">{word.meaning}</div>}
              {/* 예문 — 단어를 포함한 문장 + 예문 전용 재생 버튼(단어/예문 독립 재생). */}
              {word.example && (
                <div className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-ivory px-2.5 py-1.5">
                  <p lang="zh" className="font-cn text-sm leading-relaxed text-ink">{word.example}</p>
                  <button
                    type="button"
                    onClick={() => speak(word.example)}
                    disabled={speaking}
                    aria-label="예문 발음 듣기"
                    title="예문 듣기"
                    className={`${iconBtn} h-7 w-7 shrink-0 disabled:opacity-50`}
                  >
                    <Volume2 size={14} aria-hidden />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted">
              {uiCategory === "custom" ? "관심 주제를 입력해 보세요." : "단어를 준비 중이에요."}
            </p>
          )}
          {error && <p className="mt-2 text-center text-xs text-terra">{error}</p>}
        </div>

        {/* 좋았어요 / 비추 — 풀 단어만(자동 큐레이션) */}
        {word?.id && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => vote("like")}
              disabled={busy}
              aria-pressed={voted === "like"}
              aria-label="좋았어요"
              className={`${voteBtn} ${
                voted === "like" ? "bg-jade text-white" : "border border-jade/30 bg-white text-jade-dark hover:bg-jade-soft"
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
                voted === "dislike" ? "bg-terra text-white" : "border border-terra/30 bg-white text-terra-dark hover:bg-terra-soft"
              }`}
            >
              <ThumbsDown size={13} aria-hidden /> 비추
            </button>
          </div>
        )}

        {/* 입장 — 문장으로 표현해 볼까요! (B-3) */}
        <button
          type="button"
          onClick={enter}
          disabled={!word}
          className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-terra bg-gradient-to-b from-white to-terra-soft text-sm font-semibold text-terra transition-transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-terra/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
        >
          문장으로 표현해 볼까요!
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
