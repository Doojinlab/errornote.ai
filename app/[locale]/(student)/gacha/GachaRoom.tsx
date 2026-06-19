"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { RewardCell, RewardRarity, RewardCategory } from "@/lib/gacha";

interface PullResult {
  itemCode: string;
  itemId: string;
  rarity: RewardRarity;
  isDuplicate: boolean;
  activityCoins: number;
}

interface Props {
  initialInventory: RewardCell[];
  initialCoins: number;
  cost: number;
}

const RARITY_GLOW: Record<RewardRarity, string> = {
  common: "ring-slate-300 shadow-slate-200",
  rare: "ring-sky-400 shadow-sky-200",
  epic: "ring-fuchsia-400 shadow-fuchsia-200",
};

const RARITY_BADGE: Record<RewardRarity, string> = {
  common: "bg-slate-100 text-slate-600",
  rare: "bg-sky-100 text-sky-700",
  epic: "bg-fuchsia-100 text-fuchsia-700",
};

export default function GachaRoom({ initialInventory, initialCoins, cost }: Props) {
  const t = useTranslations("pages.student.gacha");
  const [inventory, setInventory] = useState<RewardCell[]>(initialInventory);
  const [coins, setCoins] = useState(initialCoins);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ cell: RewardCell; isDuplicate: boolean } | null>(null);

  const byCode = useMemo(
    () => new Map(inventory.map((c) => [c.code, c])),
    [inventory],
  );
  const ownedCount = inventory.filter((c) => c.owned).length;
  const canPull = coins >= cost && !pulling;

  const rarityLabel = (r: RewardRarity) =>
    r === "epic" ? t("rarityEpic") : r === "rare" ? t("rarityRare") : t("rarityCommon");
  const categoryLabel = (c: RewardCategory) =>
    c === "sound_pack"
      ? t("categorySoundPack")
      : c === "theme"
        ? t("categoryTheme")
        : c === "avatar"
          ? t("categoryAvatar")
          : t("categorySticker");

  async function pull() {
    if (!canPull) return;
    setPulling(true);
    setError(null);
    setReveal(null);
    try {
      const res = await fetch("/api/gacha", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        setError(data.code === "insufficient" ? t("notEnough") : t("failed"));
        return;
      }
      const result = (await res.json()) as PullResult;
      setCoins(result.activityCoins);
      const cell = byCode.get(result.itemCode);
      if (cell) {
        setReveal({ cell, isDuplicate: result.isDuplicate });
        if (!result.isDuplicate) {
          setInventory((prev) =>
            prev.map((c) =>
              c.code === result.itemCode
                ? { ...c, owned: true, acquiredAt: new Date().toISOString() }
                : c,
            ),
          );
        }
      }
    } catch {
      setError(t("failed"));
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 뽑기 콘솔 */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{t("coins")}</p>
            <p className="text-2xl font-bold text-amber-600">🪙 {coins}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{t("cost", { cost })}</p>
            <button
              type="button"
              onClick={pull}
              disabled={!canPull}
              className="mt-1 rounded-lg bg-fuchsia-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-700 disabled:bg-slate-300"
            >
              {pulling ? t("pulling") : t("pull")}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {/* 결과 연출 */}
        {reveal && (
          <div
            key={reveal.cell.code + (reveal.isDuplicate ? "-dup" : "-new")}
            className="mt-4 flex animate-[gachaPop_0.4s_ease-out] items-center gap-4 rounded-xl border bg-gradient-to-br from-white to-slate-50 p-4"
            role="status"
          >
            <span
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-4xl shadow-lg ring-4 ${RARITY_GLOW[reveal.cell.rarity]}`}
              aria-hidden
            >
              {reveal.cell.icon}
            </span>
            <div className="min-w-0">
              <p
                className={`text-sm font-bold ${reveal.isDuplicate ? "text-slate-500" : "text-emerald-600"}`}
              >
                {reveal.isDuplicate ? t("gotDuplicate") : t("gotNew")}
              </p>
              <p className="truncate text-base font-semibold text-slate-900">
                {reveal.cell.nameKo}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${RARITY_BADGE[reveal.cell.rarity]}`}>
                  {rarityLabel(reveal.cell.rarity)}
                </span>
                <span>{categoryLabel(reveal.cell.category)}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 컬렉션 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">{t("collection")}</h2>
          <span className="text-xs text-slate-500">
            {t("collectionProgress", { owned: ownedCount, total: inventory.length })}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {inventory.map((cell) => (
            <li
              key={cell.id}
              className={`flex flex-col items-center rounded-xl border p-3 text-center shadow-sm ${
                cell.owned ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50"
              }`}
            >
              <span
                className={`text-3xl ${cell.owned ? "" : "opacity-30 grayscale"}`}
                aria-hidden
              >
                {cell.icon}
              </span>
              <span
                className={`mt-1 truncate text-xs font-medium ${cell.owned ? "text-slate-800" : "text-slate-400"}`}
              >
                {cell.owned ? cell.nameKo : "🔒"}
              </span>
              <span
                className={`mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${RARITY_BADGE[cell.rarity]}`}
              >
                {rarityLabel(cell.rarity)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
