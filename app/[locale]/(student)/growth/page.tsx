import type { Metadata } from "next";
import LevelCard from "./_components/LevelCard";
import LeagueCard, { type LeagueRow } from "./_components/LeagueCard";
import BadgeGrid, { type BadgeItem } from "./_components/BadgeGrid";
import RewardCard from "./_components/RewardCard";

export const metadata: Metadata = {
  title: "성장 · errornote",
};

// 더미 데이터 — 파운데이션/백엔드 연동 전까지 화면 조립용(스펙 §5 성장).
const LEVEL = { level: 7, xp: 1240, nextLevelXp: 1500 };

const LEAGUE_ROWS: LeagueRow[] = [
  { rank: 1, name: "지민", xp: 2980 },
  { rank: 2, name: "서연", xp: 2610 },
  { rank: 3, name: "현우", xp: 2240 },
  { rank: 4, name: "두진", xp: 1980, me: true },
  { rank: 5, name: "민서", xp: 1750 },
  { rank: 6, name: "예준", xp: 1520 },
];

const BADGES: BadgeItem[] = [
  { id: "perfect", name: "완벽 교정", icon: "⭐", earned: true },
  { id: "streak_7", name: "7일 연속", icon: "🔥", earned: true },
  { id: "vocab_100", name: "단어 100", icon: "📚", earned: true },
  { id: "ba_master", name: "把자문", icon: "🥋", earned: true },
  { id: "explorer", name: "탐구자", icon: "🔍", earned: false },
  { id: "quiz_king", name: "퀴즈왕", icon: "🎯", earned: false },
  { id: "night_owl", name: "올빼미", icon: "🦉", earned: false },
  { id: "first_win", name: "첫 승급", icon: "🏆", earned: false },
];

const GEM_BALANCE = 120;

// 성장 허브 — LevelCard → LeagueCard → BadgeGrid → RewardCard (스펙 §5).
// 셸(max 420px 중앙·헤더·하단 4탭)은 (student)/layout.tsx 가 제공.
export default function GrowthPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink">성장</h1>
        <p className="mt-0.5 text-sm text-muted">두진님, 오늘도 한 걸음 더 나아가요.</p>
      </div>

      <LevelCard level={LEVEL.level} xp={LEVEL.xp} nextLevelXp={LEVEL.nextLevelXp} />
      <LeagueCard rows={LEAGUE_ROWS} />
      <BadgeGrid badges={BADGES} />
      <RewardCard gemBalance={GEM_BALANCE} cost={50} />
    </div>
  );
}
