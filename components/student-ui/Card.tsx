import type { HTMLAttributes, ReactNode } from "react";

/**
 * 베이스 박스. 모든 박스류 컴포넌트는 이걸 확장한다.
 * card-pop(hover 볼록 효과)이 기본 내장 — 스펙 §1.2 / §4.
 */
export default function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div
      className={`card-pop rounded-xl3 border border-hairline bg-white ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
