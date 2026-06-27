import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth";
import { GACHA_COST } from "@/lib/gacha";
import { loadGrowthData } from "@/lib/student-dashboard";
import LevelCard from "./_components/LevelCard";
import LeagueCard from "./_components/LeagueCard";
import BadgeGrid from "./_components/BadgeGrid";
import RewardCard from "./_components/RewardCard";

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
    </div>
  );
}
