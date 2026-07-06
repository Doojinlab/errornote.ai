import type { Metadata } from "next";
import { Trophy, Medal, Swords } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { GACHA_COST } from "@/lib/gacha";
import { loadGrowthData } from "@/lib/student-dashboard";
import { HubGrid, type HubLink } from "@/components/student-ui";
import LevelCard from "./_components/LevelCard";
import LeagueCard from "./_components/LeagueCard";
import BadgeGrid from "./_components/BadgeGrid";
import RewardCard from "./_components/RewardCard";

const GROWTH_LINKS: HubLink[] = [
  { href: "/league", icon: Trophy, title: "리그", desc: "이번 주 순위", tone: "gold" },
  { href: "/badges", icon: Medal, title: "뱃지", desc: "모은 성취", tone: "gold" },
  { href: "/quests", icon: Swords, title: "퀘스트", desc: "도전 과제", tone: "jade" },
];

export const metadata: Metadata = {
  title: "성장 · errornote",
};

// 성장 허브 — LevelCard → LeagueCard → BadgeGrid → RewardCard (스펙 §5).
// 셸(max 420px 중앙·헤더·하단 4탭)은 (student)/layout.tsx 가 제공.
// 데이터: gamification_stats(레벨·XP·보석=activity_coins) + badges + 익명 리그(league.ts).
export default async function GrowthPage() {
  const [ctx, data] = await Promise.all([getAuthContext(), loadGrowthData()]);
  const name = ctx?.email?.split("@")[0] ?? "";

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold text-ink">성장</h1>
        <p className="text-sm text-muted">로그인 후 성장 기록을 확인할 수 있어요.</p>
        <HubGrid title="더보기" links={GROWTH_LINKS} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">성장</h1>
        <p className="mt-0.5 text-sm text-muted">
          {name ? `${name}님, ` : ""}오늘도 한 걸음 더 나아가요.
        </p>
      </div>

      <LevelCard level={data.level} xp={data.xp} nextLevelXp={data.nextLevelXp} />
      {data.leagueRows.length > 0 && <LeagueCard rows={data.leagueRows} />}
      <BadgeGrid badges={data.badges} />
      <RewardCard gemBalance={data.gemBalance} cost={GACHA_COST} />

      <HubGrid title="더보기" links={GROWTH_LINKS} />
    </div>
  );
}
