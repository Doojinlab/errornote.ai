"use client";
import { useState } from "react";
import { ArrowRight, Target } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { HSK_AREAS, HSK_LEVELS, HSK_MODES } from "@/lib/hsk";
import type { HskArea, HskLevel, HskMode } from "@/types";

// 실전 HSK 입장 카드 (docs/dashboard-features.md §1.2 · errornote-dashboard-reference.html)
// 보기 선택형(칩): 급수 → 영역 → 모드. 입장하기 시 기존 워크스페이스를 mode 파라미터로 재사용.
const chip =
  "rounded-lg py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-1 focus-visible:ring-offset-blue-soft";
const chipOn = "bg-blue text-white";
const chipOff = "bg-white text-blue-dark border border-blue/25 hover:bg-white/70";

const groupLabel =
  "mb-2 text-[10px] font-bold uppercase tracking-wider text-blue";

export default function HskEntryCard({
  chapterId = 1,
}: {
  chapterId?: number | string;
}) {
  const router = useRouter();
  // 온보딩 목표 급수 프리필 자리 — 데이터 연동 전까지 4급 기본(§3 후속).
  const [level, setLevel] = useState<HskLevel>(4);
  const [area, setArea] = useState<HskArea>("writing"); // 쓰기 = 킬러 영역, 기본 강조
  const [mode, setMode] = useState<HskMode>("practice");

  function enter() {
    router.push(
      `/learn/${chapterId}?mode=hsk&level=${level}&area=${area}&hskMode=${mode}`,
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl2 border border-blue bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Target size={20} className="text-blue" aria-hidden />
        <span className="text-[17px] font-semibold text-blue-dark">실전 HSK</span>
        <span className="ml-auto rounded-full bg-blue-soft px-2.5 py-1 text-[11px] font-bold text-blue-dark">
          AI 무한생성
        </span>
      </div>
      <div className="h-[3px] bg-blue" aria-hidden />

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-4 bg-blue-soft p-4">
        {/* 급수 */}
        <div>
          <div className={groupLabel}>급수</div>
          <div className="grid grid-cols-4 gap-2">
            {HSK_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                aria-pressed={level === lv}
                className={`${chip} ${level === lv ? chipOn : chipOff}`}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>

        {/* 영역 */}
        <div>
          <div className={groupLabel}>영역</div>
          <div className="grid grid-cols-3 gap-2">
            {HSK_AREAS.map((a) =>
              a.disabled ? (
                <button
                  key={a.value}
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="곧 출시됩니다"
                  className={`${chip} inline-flex items-center justify-center gap-1 cursor-not-allowed border border-dashed border-blue/30 bg-white/50 text-muted`}
                >
                  {a.label}
                  <span className="rounded-full bg-blue/10 px-1.5 text-[9px] font-bold text-blue">
                    곧
                  </span>
                </button>
              ) : (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setArea(a.value)}
                  aria-pressed={area === a.value}
                  className={`${chip} ${area === a.value ? chipOn : chipOff}`}
                >
                  {a.label}
                </button>
              ),
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-blue/70">
            ✓ 말하기 모드가 열리면 알려줄게
          </div>
        </div>

        {/* 모드 */}
        <div>
          <div className={groupLabel}>모드</div>
          <div className="grid grid-cols-2 gap-2">
            {HSK_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
                title={m.desc}
                className={`${chip} ${mode === m.value ? chipOn : chipOff}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 입장하기 */}
        <button
          type="button"
          onClick={enter}
          className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-blue bg-gradient-to-b from-white to-blue-soft text-sm font-semibold text-blue transition-transform hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-soft"
        >
          입장하기
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
