import { ArrowRight, BookA, BookOpen, Bookmark, Target, Sparkles, PenLine } from "lucide-react";
import { HeroCard, HubGrid, LipButton, type HubLink } from "@/components/student-ui";
import { loadLearnData } from "@/lib/student-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { getTodayHotword } from "@/lib/hotwords";
import CardNewsRail from "./_components/CardNewsRail";
import GoalCard from "./_components/GoalCard";
import HotwordCard from "./_components/HotwordCard";
import HskEntryCard from "./_components/HskEntryCard";
import LearnEmptyState from "./_components/LearnEmptyState";
import MiniGrid from "./_components/MiniGrid";

// 학습(홈) — 오늘 할 일 허브. 스펙 §3/§5.
// 인사 → GoalRing 카드 → HeroCard → 미니 2-up(과제·동료리뷰) → 카드뉴스 가로 스크롤.
// 셸(헤더/하단탭/max-420 중앙정렬)은 (student)/layout.tsx 가 담당.
// 데이터는 lib/student-dashboard.ts(loadLearnData)에서 실연동.
const STUDY_LINKS: HubLink[] = [
  { href: "/vocabulary", icon: BookA, title: "단어장", desc: "저장한 단어 복습", tone: "blue" },
  { href: "/bookmarks", icon: Bookmark, title: "북마크", desc: "다시 볼 문장", tone: "blue" },
  { href: "/goals", icon: Target, title: "목표", desc: "학습 목표 관리", tone: "jade" },
  { href: "/graded-reading", icon: BookOpen, title: "맞춤 리딩", desc: "내 약점 문법 지문", tone: "jade" },
  { href: "/weekly-suggestions", icon: Sparkles, title: "주간 추천", desc: "이번 주 맞춤 학습", tone: "gold" },
  { href: "/handwriting", icon: PenLine, title: "한자 쓰기", desc: "획순 따라쓰기 연습", tone: "jade" },
];

export default async function LearnHomePage() {
  // getCurrentUser 는 getClaims 로 로컬 검증(네트워크 왕복 없음)이라 먼저 받고,
  // 무거운 홈 데이터와 오늘의 단어 조회를 병렬로 돌려 순차 왕복을 없앤다.
  const user = await getCurrentUser();
  const [data, todayHotword] = await Promise.all([
    loadLearnData(),
    user ? getTodayHotword(user.id) : Promise.resolve(null),
  ]);
  const studentName = data?.studentName ?? "학생";
  const active = data?.hasActiveClass ?? false;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">
          안녕, {studentName}! 👋
        </h1>
        <p className="mt-1 text-sm text-bodytx">
          오늘도 한 문장씩, 중국어 실력을 키워봐요.
        </p>
      </header>

      {active && data ? (
        // 데스크톱: 참조 레퍼런스의 2컬럼(좌 실전HSK+今日热词 / 우 목표·학습·과제·바로가기).
        // 모바일: 단일 컬럼으로 자연 스택(좌 컬럼 → 우 컬럼 순).
        <div className="lg:grid lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:items-start lg:gap-5">
          {/* 좌측 — 실전 HSK · 今日热词 */}
          <div className="flex flex-col gap-5">
            <HskEntryCard chapterId={data.today.chapterId} />
            <HotwordCard hotword={todayHotword} chapterId={data.today.chapterId} />
          </div>

          {/* 우측(중앙) — 기존 대시보드 */}
          <div className="mt-5 space-y-4 lg:mt-0">
            <GoalCard
              current={data.goal.current}
              total={data.goal.total}
              streakDays={data.streakDays}
              gems={data.gems}
            />

            <HeroCard title={data.today.title} subtitle={data.today.subtitle}>
              <LipButton variant="white" href={`/learn/${data.today.chapterId}`}>
                시작하기
                <ArrowRight size={16} aria-hidden />
              </LipButton>
            </HeroCard>

            <MiniGrid tasks={data.tasks} chapterId={data.today.chapterId} />

            <HubGrid title="바로가기" links={STUDY_LINKS} />

            {data.cardNews.length > 0 && <CardNewsRail items={data.cardNews} />}
          </div>
        </div>
      ) : (
        <>
          <LearnEmptyState />
          <HubGrid title="바로가기" links={STUDY_LINKS} />
        </>
      )}
    </div>
  );
}
