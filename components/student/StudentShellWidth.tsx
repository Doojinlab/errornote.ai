"use client";
import { usePathname } from "@/i18n/routing";

// 학생 셸 폭 — 기본은 모바일 420px 중앙 컬럼(전 페이지 공통).
// 단, 넓은 폭이 필요한 화면만 데스크톱에서 확장한다:
//   - 학습 홈(/learn): 데스크톱 2컬럼 대시보드.
//   - 실전 HSK 세션(/hsk/session): 좌(문제·지문) + 우(해설·AI 과외) 2단 풀이 화면.
// 그 외 학생 페이지는 420px 그대로 유지되어 영향 없음.
export default function StudentShellWidth({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWide = pathname === "/learn" || pathname.startsWith("/hsk/session");
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full flex-col bg-ivory max-w-[420px] ${
        isWide ? "lg:max-w-[1160px]" : ""
      }`}
    >
      {children}
    </div>
  );
}
