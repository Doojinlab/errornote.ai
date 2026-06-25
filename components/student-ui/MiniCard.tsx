import type { ReactNode } from "react";
import Card from "./Card";

type Tone = "blue" | "jade" | "terra" | "gold";

const TONE: Record<Tone, string> = {
  blue: "bg-blue-soft text-blue-dark",
  jade: "bg-jade-soft text-jade-dark",
  terra: "bg-terra-soft text-terra-dark",
  gold: "bg-gold-soft text-gold-dark",
};

/** 2-up 그리드용 미니 카드 (과제·동료리뷰 등). 스펙 §4. */
export default function MiniCard({
  icon,
  title,
  desc,
  badge,
  badgeTone = "blue",
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  badge?: string;
  badgeTone?: Tone;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        {icon ? <div className="text-blue">{icon}</div> : <span />}
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[badgeTone]}`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3 font-bold text-ink">{title}</div>
      {desc && <div className="mt-0.5 text-xs text-muted">{desc}</div>}
    </Card>
  );
}
