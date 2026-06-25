import { Card } from "@/components/student-ui";
import { Link } from "@/i18n/routing";
import type { CardNewsItem, CardNewsTone } from "./learnData";

// 전체 클래스명을 리터럴로 둬야 Tailwind v4가 감지한다(동적 조합 금지).
const TAG_TONE: Record<CardNewsTone, string> = {
  blue: "bg-blue-soft text-blue-dark",
  jade: "bg-jade-soft text-jade-dark",
  gold: "bg-gold-soft text-gold-dark",
  gem: "bg-gem-soft text-gem-dark",
};

/**
 * 카드뉴스 가로 스크롤. -mx-4 로 셸 좌우 패딩을 상쇄해 화면 끝까지 흐른다.
 * 스냅 + 박스마다 card-pop(Card 내장). 스펙 §5.
 */
export default function CardNewsRail({ items }: { items: CardNewsItem[] }) {
  return (
    <section aria-labelledby="cardnews-heading">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="cardnews-heading" className="text-base font-extrabold text-ink">
          이번 주 카드뉴스
        </h2>
        <Link
          href="/cardnews"
          className="rounded text-xs font-bold text-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
        >
          전체 보기
        </Link>
      </div>

      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <li key={item.id} className="snap-start">
            <Link
              href="/cardnews"
              className="block rounded-xl3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
            >
              <Card className="flex h-full w-[200px] flex-col p-4">
                <span
                  className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ${TAG_TONE[item.tone]}`}
                >
                  {item.tag}
                </span>
                <h3 className="mt-3 text-sm font-bold leading-snug text-ink">
                  {item.title}
                </h3>
                <p
                  lang="zh"
                  className="font-cn mt-2 text-base leading-relaxed text-bodytx"
                >
                  {item.zh}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
