import { ClipboardList, Users } from "lucide-react";
import { MiniCard } from "@/components/student-ui";
import { Link } from "@/i18n/routing";
import type { LearnHomeData } from "./learnData";

// 카드 전체를 탭 영역으로. 포커스 링은 래퍼 Link에 (스펙 §7 접근성).
const linkCls =
  "block rounded-xl3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory";

/**
 * 미니 2-up — 과제(terra·D-3) / 동료 리뷰(jade·+XP). 스펙 §5.
 * Terracotta는 마감 경고 배지에만 (화면의 5% 이하, 스펙 §2).
 * 빈 상태는 막다른 길로 두지 않고 액션을 유도한다(C-1):
 *   과제 없음 → 오늘의 학습, 리뷰 없음 → 내 오류 복습.
 */
export default function MiniGrid({
  tasks,
  chapterId,
}: {
  tasks: LearnHomeData["tasks"];
  chapterId: number | string;
}) {
  const noAssignment = tasks.assignmentDueInDays === null;
  const noReviews = tasks.peerReviewCount === 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href={noAssignment ? `/learn/${chapterId}` : "/assignments"}
        className={linkCls}
        aria-label={noAssignment ? "예정된 과제 없음 — 오늘의 학습 시작하기" : "과제 보기"}
      >
        <MiniCard
          icon={<ClipboardList size={20} aria-hidden />}
          title="과제"
          desc={noAssignment ? "오늘의 학습 시작하기 →" : tasks.assignmentTitle}
          badge={
            tasks.assignmentDueInDays !== null
              ? `D-${tasks.assignmentDueInDays}`
              : undefined
          }
          badgeTone="terra"
        />
      </Link>
      <Link
        href={noReviews ? "/errors" : "/peer-review"}
        className={linkCls}
        aria-label={noReviews ? "리뷰할 글 없음 — 내 오류 복습하기" : "동료 리뷰 하기"}
      >
        <MiniCard
          icon={<Users size={20} aria-hidden />}
          title="동료 리뷰"
          desc={noReviews ? "내 오류 복습하기 →" : tasks.peerReviewDesc}
          badge={tasks.peerReviewCount > 0 ? `${tasks.peerReviewCount}건` : undefined}
          badgeTone="jade"
        />
      </Link>
    </div>
  );
}
