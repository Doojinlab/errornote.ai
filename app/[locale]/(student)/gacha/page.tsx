import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getRewardInventory, GACHA_COST, type RewardCell } from "@/lib/gacha";
import { getSnapshot } from "@/lib/gamification";
import GachaRoom from "./GachaRoom";

interface GachaData {
  inventory: RewardCell[];
  coins: number;
}

async function loadGacha(): Promise<GachaData | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const [inventory, snapshot] = await Promise.all([
      getRewardInventory(user.id),
      getSnapshot(user.id),
    ]);
    return { inventory, coins: snapshot.activity_coins };
  } catch {
    return null;
  }
}

export default async function GachaPage() {
  const [t, data] = await Promise.all([
    getTranslations("pages.student.gacha"),
    loadGacha(),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>
      {data ? (
        <GachaRoom
          initialInventory={data.inventory}
          initialCoins={data.coins}
          cost={GACHA_COST}
        />
      ) : (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          {t("empty")}
        </p>
      )}
    </section>
  );
}
