import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
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
  const user = await getCurrentUser();
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
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <MistakeFeedClient initialMine={data.mine} initialPublic={data.publicFeed} />
    </section>
  );
}
