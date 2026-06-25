import { Trophy } from "lucide-react";
import { Card } from "@/components/student-ui";

export interface LeagueRow {
  rank: number;
  name: string;
  xp: number;
  me?: boolean;
}

/**
 * 리그 카드 — 트로피 + 주간 순위 리스트. 내 행은 bg-blue-soft 하이라이트.
 * 트로피=gold(연속학습/트로피 색 규칙). 스펙 §4 / §5.
 */
export default function LeagueCard({
  title = "이번 주 리그",
  rows,
}: {
  title?: string;
  rows: LeagueRow[];
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-soft text-gold-dark">
          <Trophy size={18} aria-hidden />
        </span>
        <h2 className="font-extrabold text-ink">{title}</h2>
        <span className="ml-auto text-xs font-bold text-muted">상위 10명 승급</span>
      </div>

      <ol className="mt-4 space-y-1">
        {rows.map((row) => (
          <li
            key={row.rank}
            aria-current={row.me ? "true" : undefined}
            className={`flex items-center gap-3 rounded-xl2 px-3 py-2 ${
              row.me ? "bg-blue-soft" : ""
            }`}
          >
            <span
              className={`w-6 text-center text-sm font-extrabold ${
                row.rank <= 3 ? "text-gold-dark" : "text-muted"
              }`}
            >
              {row.rank}
            </span>
            <span
              className={`min-w-0 flex-1 truncate font-bold ${
                row.me ? "text-blue-dark" : "text-ink"
              }`}
            >
              {row.name}
              {row.me && <span className="ml-1 text-xs font-bold text-blue">나</span>}
            </span>
            <span className="text-sm font-extrabold text-bodytx">
              {row.xp.toLocaleString()} XP
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
