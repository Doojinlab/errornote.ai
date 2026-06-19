import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import {
  getMyMistakes,
  getPublicFeed,
  type MistakeEntry,
  type PublicMistake,
} from "@/lib/mistake-feed";
import MistakeFeedClient from "./MistakeFeedClient";

interface Data {
  mine: MistakeEntry[];
  publicFeed: PublicMistake[];
}

async function load(): Promise<Data> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { mine: [], publicFeed: [] };
  try {
    const [mine, publicFeed] = await Promise.all([
      getMyMistakes(user.id),
      getPublicFeed(30),
    ]);
    return { mine, publicFeed };
  } catch {
    return { mine: [], publicFeed: [] };
  }
}

export default async function MistakeFeedPage() {
  const [t, data] = await Promise.all([
    getTranslations("pages.student.mistakeFeed"),
    load(),
  ]);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>
      <MistakeFeedClient initialMine={data.mine} initialPublic={data.publicFeed} />
    </section>
  );
}
