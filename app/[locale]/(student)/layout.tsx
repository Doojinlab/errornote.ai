import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createServerClient } from "@/lib/supabase";
import LevelBar from "@/components/gamification/LevelBar";
import StreakCounter from "@/components/gamification/StreakCounter";
import Companion from "@/components/gamification/Companion";
import StudentSoundShell from "@/components/gamification/StudentSoundShell";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import StudentMobileNav from "@/components/StudentMobileNav";
import { companionStage, companionEmoji } from "@/lib/companion";

interface GameStats {
  level: 1 | 2 | 3 | 4;
  xp: number;
  streak_days: number;
  mastery_points: number;
}

interface BadgeRow {
  badge_type: string;
}

async function loadStats(): Promise<GameStats | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("gamification_stats")
    .select("level, xp, streak_days, mastery_points")
    .eq("student_id", user.id)
    .maybeSingle();
  return (data as GameStats | null) ?? null;
}

async function loadEarnedBadgeIds(): Promise<string[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("badges")
    .select("badge_type")
    .eq("student_id", user.id);
  const rows = (data as BadgeRow[] | null) ?? [];
  return rows.map((r) => r.badge_type);
}

type NavKey =
  | "learn"
  | "errors"
  | "vocabulary"
  | "bookmarks"
  | "progress"
  | "cardnews"
  | "assignments"
  | "badges"
  | "goals"
  | "translate"
  | "urlAnalyze"
  | "portfolio"
  | "peerReview"
  | "pronunciation"
  | "live"
  | "weeklySuggestions"
  | "notifications"
  | "inbox"
  | "dataExport"
  | "settings";

const NAV: Array<{ href: string; key: NavKey }> = [
  { href: "/learn/1", key: "learn" },
  { href: "/errors", key: "errors" },
  { href: "/vocabulary", key: "vocabulary" },
  { href: "/bookmarks", key: "bookmarks" },
  { href: "/progress", key: "progress" },
  { href: "/cardnews", key: "cardnews" },
  { href: "/assignments", key: "assignments" },
  { href: "/badges", key: "badges" },
  { href: "/goals", key: "goals" },
  { href: "/translate", key: "translate" },
  { href: "/analyze-url", key: "urlAnalyze" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/peer-review", key: "peerReview" },
  { href: "/pronunciation", key: "pronunciation" },
  { href: "/live", key: "live" },
  { href: "/weekly-suggestions", key: "weeklySuggestions" },
  { href: "/notifications/inbox", key: "inbox" },
  { href: "/notifications", key: "notifications" },
  { href: "/data-export", key: "dataExport" },
  { href: "/settings", key: "settings" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const [stats, earnedBadgeIds, t] = await Promise.all([
    loadStats(),
    loadEarnedBadgeIds(),
    getTranslations("nav.student"),
  ]);
  const tMeta = await getTranslations("meta");
  const tCompanion = await getTranslations("pages.components.companion");
  const mobileNavItems = NAV.map((n) => ({ href: n.href, label: t(n.key) }));

  // 误 동반자: 진화 단계는 mastery_points 기반, 문구는 무벌점 톤.
  const companionStageNum = companionStage(stats?.mastery_points ?? 0);
  const companionSubtitle =
    stats && stats.streak_days > 0
      ? tCompanion("streak", { days: stats.streak_days })
      : tCompanion("welcome");

  return (
    <StudentSoundShell
      level={stats?.level ?? null}
      streakDays={stats?.streak_days ?? null}
      earnedBadgeIds={earnedBadgeIds}
    >
      <div className="flex min-h-dvh flex-col bg-slate-100">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-2">
          <StudentMobileNav
            items={mobileNavItems}
            openLabel={t("menuOpen")}
            closeLabel={t("menuClose")}
          />
          <Link href="/learn/1" className="text-sm font-bold text-indigo-600">
            {tMeta("appName")}
          </Link>
          <nav className="hidden gap-1 sm:flex" aria-label={tMeta("appName")}>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher />
            <Companion
              emoji={companionEmoji(companionStageNum)}
              title={tCompanion(`stage${companionStageNum}`)}
              subtitle={companionSubtitle}
              ariaLabel={tCompanion("ariaLabel")}
            />
            {stats && <StreakCounter days={stats.streak_days} />}
            {stats && (
              <div className="hidden w-56 sm:block">
                <LevelBar level={stats.level} xp={stats.xp} />
              </div>
            )}
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </StudentSoundShell>
  );
}
