import { Gem, Sparkles } from "lucide-react";
import { LipButton } from "@/components/student-ui";

/**
 * 보상 뽑기 카드 — gem 그라데이션 + LipButton(variant=gold).
 * Card(흰 배경) 대신 HeroCard처럼 자체 card-pop 박스로 그라데이션을 깐다.
 * 스펙 §4 / §5. 보석=gem, 메인 액션 버튼은 gold(뽑기 강조).
 */
export default function RewardCard({
  gemBalance,
  cost = 50,
  href = "/gacha",
}: {
  gemBalance: number;
  cost?: number;
  href?: string;
}) {
  return (
    <div className="card-pop relative overflow-hidden rounded-xl3 bg-gradient-to-br from-gem to-gem-dark p-5 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles size={18} aria-hidden />
          <h2 className="text-lg font-extrabold leading-tight">보상 뽑기</h2>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm font-extrabold">
            <Gem size={15} aria-hidden />
            {gemBalance.toLocaleString()}
          </span>
        </div>

        <p className="mt-1 text-sm text-white/85">
          모은 보석으로 새 아이템을 뽑아 보세요.
        </p>

        <div className="mt-4">
          <LipButton variant="gold" href={href} full>
            {cost} 보석으로 뽑기
          </LipButton>
        </div>
      </div>
    </div>
  );
}
