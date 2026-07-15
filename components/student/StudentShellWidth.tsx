"use client";
import { usePathname } from "@/i18n/routing";

// 학생 셸 폭 — 기본은 모바일 420px 중앙 컬럼(전 페이지 공통).
// 단, 학습 홈(/learn)만 데스크톱에서 넓은 대시보드 폭으로 확장한다.
// (docs/errornote-dashboard-reference.html — 데스크톱 2컬럼 레퍼런스)
// 다른 학생 페이지는 420px 그대로 유지되어 영향 없음.
export default function StudentShellWidth({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === "/learn";
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full flex-col bg-ivory max-w-[420px] ${
        isDashboard ? "lg:max-w-[1160px]" : ""
      }`}
    >
      {children}
    </div>
  );
}
