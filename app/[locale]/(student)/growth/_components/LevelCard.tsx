import { Card } from "@/components/student-ui";

/**
 * 레벨 카드 — Lv 배지 + XP 바(blue→gem 그라데이션) + 다음 레벨까지 남은 XP.
 * 스펙 §4(성장 탭 전용) / §5(성장). 박스라 card-pop 내장(Card).
 */
export default function LevelCard({
  level,
  xp,
  nextLevelXp,
}: {
  level: number;
  xp: number;
  nextLevelXp: number;
}) {
  const remaining = Math.max(nextLevelXp - xp, 0);
  const pct = nextLevelXp > 0 ? Math.min(Math.max(xp / nextLevelXp, 0), 1) : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        {/* Lv 배지 */}
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue to-gem text-white">
          <span className="text-[10px] font-bold leading-none opacity-90">Lv</span>
          <span className="text-xl font-extrabold leading-none">{level}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-extrabold text-ink">레벨 {level}</span>
            <span className="text-xs font-bold text-muted">
              {xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
            </span>
          </div>

          {/* XP 바 — blue→gem 그라데이션 */}
          <div
            className="mt-2 h-3 w-full overflow-hidden rounded-full bg-hairline"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={nextLevelXp}
            aria-valuenow={xp}
            aria-label={`레벨 ${level} 경험치`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue to-gem transition-[width] duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-bodytx">
            다음 레벨까지{" "}
            <span className="font-extrabold text-blue-dark">
              {remaining.toLocaleString()} XP
            </span>{" "}
            남았어요
          </p>
        </div>
      </div>
    </Card>
  );
}
