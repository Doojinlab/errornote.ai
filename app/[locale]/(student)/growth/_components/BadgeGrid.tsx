import { Lock } from "lucide-react";
import { Card } from "@/components/student-ui";

export interface BadgeItem {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
}

/**
 * 배지 그리드 — 4열. 획득=골드 그라데이션, 미획득=회색 + 자물쇠.
 * 스펙 §4 / §5. 바깥 박스는 Card(card-pop), 각 배지 칸은 정적.
 */
export default function BadgeGrid({ badges }: { badges: BadgeItem[] }) {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-extrabold text-ink">배지</h2>
        <span className="text-xs font-bold text-muted">
          {earnedCount} / {badges.length} 획득
        </span>
      </div>

      <ul className="mt-4 grid grid-cols-4 gap-3">
        {badges.map((b) => (
          <li key={b.id} className="flex flex-col items-center gap-1">
            <span
              aria-hidden
              className={`flex aspect-square w-full items-center justify-center rounded-2xl text-2xl ${
                b.earned
                  ? "bg-gradient-to-br from-gold to-gold-dark text-white shadow-sm"
                  : "bg-hairline text-muted"
              }`}
            >
              {b.earned ? b.icon : <Lock size={18} aria-hidden />}
            </span>
            <span
              className={`w-full truncate text-center text-[11px] font-bold ${
                b.earned ? "text-ink" : "text-muted"
              }`}
              title={b.name}
            >
              {b.name}
            </span>
            <span className="sr-only">{b.earned ? "획득함" : "미획득"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
