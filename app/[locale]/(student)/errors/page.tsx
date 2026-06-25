import WeeklySummary from "./_components/WeeklySummary";
import ErrorReviewCard, { type ErrorItem } from "./_components/ErrorReviewCard";

// 더미 데이터 — 리디자인 시안용(스펙 §5). 실제 데이터 연동은 파운데이션 머지 후 별도 작업.
const ERRORS: ErrorItem[] = [
  {
    id: "e1",
    category: "어순",
    chapter: "3과",
    date: "06.21",
    before: { pre: "我昨天", mark: "看书在图书馆", post: "。" },
    after: "我昨天在图书馆看书。",
    note: "장소를 나타내는 ‘在+장소’는 동사 앞에 와요. ‘도서관에서 책을 읽다’ 순서로 쓰세요.",
  },
  {
    id: "e2",
    category: "양사",
    chapter: "3과",
    date: "06.21",
    before: { pre: "我买了", mark: "三个书", post: "。" },
    after: "我买了三本书。",
    note: "책을 셀 때 양사는 ‘个’가 아니라 ‘本’을 써요.",
  },
  {
    id: "e3",
    category: "시태",
    chapter: "2과",
    date: "06.18",
    before: { pre: "我昨天已经", mark: "吃饭", post: "。" },
    after: "我昨天已经吃饭了。",
    note: "완료된 동작에는 동사 뒤에 ‘了’를 붙여 마무리해요.",
  },
  {
    id: "e4",
    category: "어휘",
    chapter: "2과",
    date: "06.18",
    before: { pre: "我很喜欢", mark: "这个的颜色", post: "。" },
    after: "我很喜欢这个颜色。",
    note: "‘这个/那个 + 명사’ 사이에는 ‘的’를 넣지 않아요.",
  },
];

export default function ErrorsPage() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-extrabold text-ink">오류 기록</h1>
        <p className="text-xs text-muted">최근 {ERRORS.length}건</p>
      </div>

      <WeeklySummary fixed={12} accuracy={87} />

      <div className="space-y-3">
        {ERRORS.map((item) => (
          <ErrorReviewCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
