import { Link } from "@/i18n/routing";
import { User } from "lucide-react";
import { createServerClient } from "@/lib/supabase";
import StudentSoundShell from "@/components/gamification/StudentSoundShell";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { BottomNav, StatChip } from "@/components/student-ui";

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

// 학생 셸 — 모바일 퍼스트(max 420px 중앙) + 하단 4탭(스펙 §3/§7).
// 상단 22개 가로 메뉴는 폐기, 사운드/게임화 사이드이펙트는 StudentSoundShell 로 유지.
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stats, earnedBadgeIds] = await Promise.all([
    loadStats(),
    loadEarnedBadgeIds(),
  ]);

  return (
    <StudentSoundShell
      level={stats?.level ?? null}
      streakDays={stats?.streak_days ?? null}
      earnedBadgeIds={earnedBadgeIds}
    >
      <div className="min-h-dvh bg-ivory text-ink">
        <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-ivory">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-hairline bg-ivory/90 px-4 py-3 backdrop-blur">
            <Link
              href="/learn"
              className="text-base font-extrabold tracking-tight text-ink"
            >
              error<span className="text-blue">note</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <StatChip type="flame" value={stats?.streak_days ?? 0} />
              <LanguageSwitcher />
              <Link
                href="/settings"
                aria-label="프로필"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white text-bodytx"
              >
                <User size={18} aria-hidden />
              </Link>
            </div>
          </header>

          <main className="flex-1 px-4 pb-[90px] pt-4">{children}</main>

          <BottomNav />
        </div>
      </div>
    </StudentSoundShell>
  );
}
