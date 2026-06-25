"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";

type Variant = "blue" | "jade" | "gold" | "white";

// 듀오링고식 입체 버튼 — 하단 4px 진한 테두리 + press 시 눌림(.lip, globals.css §1.2).
const VARIANT: Record<Variant, string> = {
  blue: "bg-blue text-white border-blue-dark",
  jade: "bg-jade text-white border-jade-dark",
  gold: "bg-gold text-white border-gold-dark",
  white: "bg-white text-ink border-hairline",
};

interface LipButtonProps {
  variant?: Variant;
  full?: boolean;
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export default function LipButton({
  variant = "blue",
  full = false,
  href,
  type = "button",
  onClick,
  className = "",
  children,
}: LipButtonProps) {
  const cls = `lip inline-flex items-center justify-center gap-1.5 rounded-2xl border-b-4 px-5 py-3 font-extrabold ${VARIANT[variant]} ${full ? "w-full" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
