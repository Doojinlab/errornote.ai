import { Card, GoalRing, StatChip } from "@/components/student-ui";

/**
 * 오늘의 목표 카드 — GoalRing(jade) + 진행 문구 + 연속학습/보석 칩.
 * 박스이므로 card-pop은 Card에 내장. 스펙 §5.
 */
export default function GoalCard({
  current,
  total,
  streakDays,
  gems,
}: {
  current: number;
  total: number;
  streakDays: number;
  gems: number;
}) {
  const remaining = Math.max(total - current, 0);

  return (
    <Card className="flex items-center gap-4 p-4">
      <GoalRing current={current} total={total} />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-extrabold text-ink">오늘의 목표</h2>
        <p className="mt-0.5 text-sm text-bodytx">
          {remaining > 0
            ? `${remaining}문장만 더 교정하면 목표 달성!`
            : "오늘 목표를 모두 달성했어요 🎉"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatChip type="flame" value={`${streakDays}일`} />
          <StatChip type="gem" value={gems} />
        </div>
      </div>
    </Card>
  );
}
