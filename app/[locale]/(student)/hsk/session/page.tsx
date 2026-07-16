import { Link } from "@/i18n/routing";
import {
  parseHskSessionParams,
  hskAreaLabel,
  hskModeLabel,
  hskSessionTypeLabel,
  hskGradingModeLabel,
} from "@/lib/hsk";
import HskSessionClient from "./HskSessionClient";

type SearchParams = Record<string, string | string[] | undefined>;
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// 실전 HSK 세션 (A-α 스캐폴드) — 카드 선택값을 받아 영역별 문제를 생성·제시.
// 연습/실전 타이머·성적표·오디오 컨트롤은 후속(A-β/δ)에서 확장.
export default async function HskSessionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const params = parseHskSessionParams({
    level: first(sp.level),
    area: first(sp.area),
    hskMode: first(sp.hskMode),
    sessionType: first(sp.sessionType),
    gradingMode: first(sp.gradingMode),
  });
  if (!params) {
    return (
      <section className="p-8 text-center">
        <p className="text-sm text-bodytx">잘못된 접근이에요. 실전 HSK 카드에서 다시 시작해 주세요.</p>
        <Link href="/learn" className="mt-3 inline-block text-sm font-semibold text-blue">
          학습 홈으로 →
        </Link>
      </section>
    );
  }

  const chapterId = first(sp.chapter) ?? "1";

  const crumbs = [
    `HSK ${params.level}급`,
    hskAreaLabel(params.area),
    hskModeLabel(params.mode),
    params.sessionType ? hskSessionTypeLabel(params.sessionType) : null,
    params.mode === "practice" && params.sessionType === "drill" && params.gradingMode
      ? hskGradingModeLabel(params.gradingMode)
      : null,
  ].filter(Boolean) as string[];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">실전 HSK</h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {crumbs.map((c, i) => (
            <span
              key={i}
              className="rounded-full bg-blue-soft px-2 py-0.5 font-semibold text-blue-dark"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <HskSessionClient params={params} chapterId={chapterId} />
    </section>
  );
}
