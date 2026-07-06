import { getTranslations } from "next-intl/server";
import TranslateCompare from "./TranslateCompare";

export default async function TranslatePage() {
  const t = await getTranslations("pages.student.translate");
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>
      <TranslateCompare />
    </section>
  );
}
