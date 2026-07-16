import { getTranslations } from "next-intl/server";
import HandwritingClient from "./HandwritingClient";

// 한자 획순 손글씨 연습 (gamification-spec G5).
// hanzi-writer 로 획순 애니메이션 + 따라쓰기(획별 채점). 획순 데이터는 public/hanzi-data 로컬 번들.
export default async function HandwritingPage() {
  const t = await getTranslations("pages.student.handwriting");

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted">{t("subtitle")}</p>
      </div>

      <HandwritingClient />
    </section>
  );
}
