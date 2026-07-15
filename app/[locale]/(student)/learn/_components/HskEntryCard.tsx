"use client";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card } from "@/components/student-ui";
import { useRouter } from "@/i18n/routing";
import { HSK_AREAS, HSK_LEVELS, HSK_MODES } from "@/lib/hsk";
import type { HskArea, HskLevel, HskMode } from "@/types";

// 실전 HSK 입장 카드 (docs/dashboard-features.md §1.2) — 보기 선택형(칩): 급수 → 영역 → 모드.
// 입장하기 시 새 화면을 만들지 않고 기존 워크스페이스를 mode 파라미터로 재사용한다.
const chipBase =
  "rounded-full px-3 py-1 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white";

export default function HskEntryCard({ chapterId = 1 }: { chapterId?: number | string }) {
  const router = useRouter();
  // 온보딩 목표 급수 프리필 자리 — 데이터 연동 전까지 4급 기본(§3 후속).
  const [level, setLevel] = useState<HskLevel>(4);
  const [area, setArea] = useState<HskArea>("writing"); // 쓰기 = 킬러 영역, 기본 강조
  const [mode, setMode] = useState<HskMode>("practice");

  function enter() {
    // 학생의 현재 챕터로 워크스페이스 진입(하드코딩 1 대신).
    router.push(
      `/learn/${chapterId}?mode=hsk&level=${level}&area=${area}&hskMode=${mode}`,
    );
  }

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl2 bg-blue-soft text-blue">
          <GraduationCap size={18} aria-hidden />
        </span>
        <div>
          <div className="font-bold text-ink">실전 HSK</div>
          <div className="text-[11px] text-muted">기출 유형 AI 문제로 훈련</div>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {/* 급수 */}
        <div>
          <div className="mb-1 text-[11px] font-bold text-muted">급수</div>
          <div className="flex flex-wrap gap-1.5">
            {HSK_LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                aria-pressed={level === lv}
                className={`${chipBase} ${
                  level === lv
                    ? "bg-blue text-white"
                    : "bg-ivory text-bodytx hover:bg-blue-soft"
                }`}
              >
                HSK {lv}
              </button>
            ))}
          </div>
        </div>

        {/* 영역 */}
        <div>
          <div className="mb-1 text-[11px] font-bold text-muted">영역</div>
          <div className="flex flex-wrap gap-1.5">
            {HSK_AREAS.map((a) =>
              a.disabled ? (
                <button
                  key={a.value}
                  type="button"
                  disabled
                  title="곧 출시됩니다"
                  className={`${chipBase} cursor-not-allowed border border-dashed border-hairline bg-white text-muted opacity-70`}
                >
                  {a.label} · 곧
                </button>
              ) : (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setArea(a.value)}
                  aria-pressed={area === a.value}
                  className={`${chipBase} ${
                    area === a.value
                      ? "bg-blue text-white"
                      : "bg-ivory text-bodytx hover:bg-blue-soft"
                  }`}
                >
                  {a.label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* 모드 */}
        <div>
          <div className="mb-1 text-[11px] font-bold text-muted">모드</div>
          <div className="flex flex-wrap gap-1.5">
            {HSK_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
                title={m.desc}
                className={`${chipBase} ${
                  mode === m.value
                    ? "bg-blue text-white"
                    : "bg-ivory text-bodytx hover:bg-blue-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={enter}
        className="mt-4 w-full rounded-xl2 bg-ink py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
      >
        입장하기
      </button>
    </Card>
  );
}
