import type { ReactNode } from "react";

/**
 * 오늘의 학습 hero — blue 그라데이션, 흰 글씨, 우상단 반투명 원 장식. 스펙 §4.
 * 내부에 <LipButton variant="white"> 등을 children 으로 넣는다.
 */
export default function HeroCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`card-pop relative overflow-hidden rounded-xl3 bg-gradient-to-br from-blue to-blue-dark p-5 text-white ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10"
      />
      <div className="relative">
        <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
