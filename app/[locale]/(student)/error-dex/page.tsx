import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getDex, type DexCell, type DexCellStatus } from "@/lib/error-dex";

async function loadDex(): Promise<DexCell[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  try {
    return await getDex(user.id);
  } catch {
    // 도감 조회 실패 시 빈 상태로 폴백(페이지가 깨지지 않도록).
    return [];
  }
}

const STATUS_STYLE: Record<DexCellStatus, string> = {
  unseen: "border-slate-200 bg-slate-50 text-slate-400",
  encountered: "border-amber-200 bg-amber-50 text-amber-800",
  tamed: "border-indigo-200 bg-indigo-50 text-indigo-800",
  graduated: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

const STATUS_BADGE: Record<DexCellStatus, string> = {
  unseen: "bg-slate-200 text-slate-500",
  encountered: "bg-amber-200 text-amber-900",
  tamed: "bg-indigo-200 text-indigo-900",
  graduated: "bg-emerald-200 text-emerald-900",
};

const STATUS_EMOJI: Record<DexCellStatus, string> = {
  unseen: "❔",
  encountered: "👾",
  tamed: "🤝",
  graduated: "🎓",
};

export default async function ErrorDexPage() {
  const [t, cells] = await Promise.all([
    getTranslations("pages.student.errorDex"),
    loadDex(),
  ]);

  const total = cells.length;
  const collected = cells.filter((c) => c.status !== "unseen").length;
  const graduated = cells.filter((c) => c.status === "graduated").length;

  const statusLabel: Record<DexCellStatus, string> = {
    unseen: t("statusUnseen"),
    encountered: t("statusEncountered"),
    tamed: t("statusTamed"),
    graduated: t("statusGraduated"),
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>

      {total === 0 ? (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          {t("empty")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm">
              {t("progress", { collected, total })}
            </span>
            {graduated > 0 && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 shadow-sm">
                🎓 {t("graduatedCount", { count: graduated })}
              </span>
            )}
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cells.map((cell) => {
              const seen = cell.status !== "unseen";
              return (
                <li
                  key={cell.species.id}
                  className={`rounded-xl border p-3 shadow-sm transition-colors ${STATUS_STYLE[cell.status]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl" aria-hidden>
                      {STATUS_EMOJI[cell.status]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[cell.status]}`}
                    >
                      {statusLabel[cell.status]}
                    </span>
                  </div>
                  <h2 className="mt-2 truncate text-sm font-bold">
                    {seen ? cell.species.name_ko : t("lockedName")}
                  </h2>
                  {seen && (
                    <p className="truncate text-xs opacity-80">
                      {cell.species.name_zh}
                      {cell.species.hsk_level != null &&
                        ` · ${t("hsk", { level: cell.species.hsk_level })}`}
                    </p>
                  )}
                  {seen && cell.encounterCount > 0 && (
                    <p className="mt-1 text-[11px] opacity-70">
                      {t("encounterCount", { count: cell.encounterCount })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div
            className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-xs text-slate-500 shadow-sm"
            aria-label={t("legendTitle")}
          >
            {(["encountered", "tamed", "graduated"] as DexCellStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span aria-hidden>{STATUS_EMOJI[s]}</span>
                {statusLabel[s]}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
