import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import {
  getLeagueStandings,
  leagueTier,
  type LeagueStanding,
  type LeagueTier,
} from "@/lib/league";

interface ClassRef {
  id: string;
  name: string;
}

interface EnrollmentJoin {
  class_id: string;
  classes: { id: string; name: string; is_active: boolean } | null;
}

interface LeagueData {
  klass: ClassRef;
  standings: LeagueStanding[];
}

/** 학생의 활성 수업 1개를 고른다(여러 개면 첫 번째 활성). 없으면 null. */
async function resolveActiveClass(): Promise<ClassRef | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("enrollments")
    .select("class_id, classes(id, name, is_active)")
    .eq("student_id", user.id);

  const rows = (data as EnrollmentJoin[] | null) ?? [];
  const active = rows.find((r) => r.classes?.is_active) ?? rows[0];
  if (!active?.classes) return null;
  return { id: active.classes.id, name: active.classes.name };
}

async function loadLeague(): Promise<LeagueData | null> {
  const klass = await resolveActiveClass();
  if (!klass) return null;
  try {
    const standings = await getLeagueStandings(klass.id);
    return { klass, standings };
  } catch {
    return { klass, standings: [] };
  }
}

const TIER_STYLE: Record<LeagueTier, string> = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
};

const TIER_EMOJI: Record<LeagueTier, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
};

export default async function LeaguePage() {
  const [t, data] = await Promise.all([
    getTranslations("pages.student.league"),
    loadLeague(),
  ]);

  const tierLabel: Record<LeagueTier, string> = {
    bronze: t("tierBronze"),
    silver: t("tierSilver"),
    gold: t("tierGold"),
  };

  const me = data?.standings.find((s) => s.isMe) ?? null;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      {!data ? (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          {t("noClass")}
        </p>
      ) : data.standings.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          {t("empty")}
        </p>
      ) : (
        <>
          {me && (
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
              <span className="font-semibold text-indigo-800">
                #{me.rank} · {t("you")}
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_STYLE[me.tier]}`}>
                  {TIER_EMOJI[me.tier]} {tierLabel[me.tier]}
                </span>
                <span className="font-bold text-indigo-700">{t("pointsValue", { points: me.points })}</span>
              </span>
            </div>
          )}

          <table className="w-full overflow-hidden rounded-xl bg-white text-sm shadow-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="px-3 py-2 font-medium">{t("rank")}</th>
                <th className="px-3 py-2 font-medium">{t("player")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("points")}</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((s) => (
                <tr
                  key={`${s.rank}-${s.nickname}`}
                  className={`border-b last:border-0 ${s.isMe ? "bg-indigo-50/60 font-semibold" : ""}`}
                >
                  <td className="px-3 py-2 tabular-nums text-slate-600">{s.rank}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden>{TIER_EMOJI[leagueTier(s.points)]}</span>
                      <span className="truncate text-slate-800">{s.nickname}</span>
                      {s.isMe && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
                          {t("you")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {t("pointsValue", { points: s.points })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
