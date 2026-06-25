import { ArrowRight } from "lucide-react";
import { HeroCard, LipButton } from "@/components/student-ui";
import CardNewsRail from "./_components/CardNewsRail";
import GoalCard from "./_components/GoalCard";
import LearnEmptyState from "./_components/LearnEmptyState";
import MiniGrid from "./_components/MiniGrid";
import { getLearnHomeData } from "./_components/learnData";

// 학습(홈) — 오늘 할 일 허브. 스펙 §3/§5.
// 인사 → GoalRing 카드 → HeroCard → 미니 2-up(과제·동료리뷰) → 카드뉴스 가로 스크롤.
// 셸(헤더/하단탭/max-420 중앙정렬)은 (student)/layout.tsx 가 담당.
// 데이터는 현재 더미(learnData) — 서버 연동은 후속.
export default function LearnHomePage() {
  const data = getLearnHomeData();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">
          안녕, {data.studentName}! 👋
        </h1>
        <p className="mt-1 text-sm text-bodytx">
          오늘도 한 문장씩, 중국어 실력을 키워봐요.
        </p>
      </header>

      {data.hasActiveClass ? (
        <>
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

          <MiniGrid tasks={data.tasks} />

          <CardNewsRail items={data.cardNews} />
        </>
      ) : (
        <LearnEmptyState />
      )}
    </div>
  );
}
