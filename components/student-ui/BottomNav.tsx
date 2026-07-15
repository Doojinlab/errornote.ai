"use client";

import { Link, usePathname } from "@/i18n/routing";
import {
  Home,
  AlertCircle,
  NotebookPen,
  Wrench,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

// 22개 상단 메뉴 → 하단 탭 (스펙 §3). 오답 노트를 자주 열람하도록 탭에 직접 노출.
const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/learn", label: "학습", icon: Home },
  { href: "/errors", label: "오류", icon: AlertCircle },
  { href: "/quiz-mistakes", label: "오답", icon: NotebookPen },
  { href: "/tools", label: "도구", icon: Wrench },
  { href: "/growth", label: "성장", icon: TrendingUp },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[74px] w-full max-w-[420px] items-stretch border-t border-hairline bg-white/90 backdrop-blur"
    >
      {ITEMS.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-1 ${
              active ? "text-blue" : "text-muted"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
            <span className="text-[10px] font-bold">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
