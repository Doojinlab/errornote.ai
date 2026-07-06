import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import Card from "./Card";

type Tone = "blue" | "jade" | "terra" | "gold";

const TONE: Record<Tone, string> = {
  blue: "bg-blue-soft text-blue",
  jade: "bg-jade-soft text-jade-dark",
  terra: "bg-terra-soft text-terra-dark",
  gold: "bg-gold-soft text-gold-dark",
};

export interface HubLink {
  href: string;
  icon: LucideIcon;
  title: string;
  desc?: string;
  /** 우상단 배지(예: 미확인 3). 없으면 바로가기 화살표 표시. */
  badge?: string;
  tone?: Tone;
}

/**
 * 허브 하위 진입점 2-up 그리드 (내비게이션/IA).
 * 각 허브(학습·오류·도구·성장)에서 관련 기능으로 나가는 바로가기를 모아 준다.
 * MiniCard/ToolCard 와 동일한 카드 언어(card-pop·rounded-xl3·hairline·soft tone)를 따른다.
 */
export default function HubGrid({
  title,
  links,
}: {
  title?: string;
  links: HubLink[];
}) {
  return (
    <section className="space-y-3">
      {title && (
        <h2 className="text-sm font-bold text-bodytx">{title}</h2>
      )}
      <div className="grid grid-cols-2 gap-3">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="block rounded-xl3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
            >
              <Card className="h-full p-4">
                <div className="flex items-start justify-between">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl2 ${TONE[l.tone ?? "blue"]}`}
                  >
                    <Icon size={20} aria-hidden />
                  </span>
                  {l.badge ? (
                    <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-bold text-blue-dark">
                      {l.badge}
                    </span>
                  ) : (
                    <ArrowUpRight size={16} className="text-muted" aria-hidden />
                  )}
                </div>
                <div className="mt-3 font-bold text-ink">{l.title}</div>
                {l.desc && (
                  <div className="mt-0.5 text-xs text-muted">{l.desc}</div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
