// 학습(홈) 화면 데이터 타입. 실제 로더/매핑은 lib/student-dashboard.ts(loadLearnData).
// 더미(getLearnHomeData)는 제거됨 — 화면은 서버에서 실데이터를 주입받는다.
// 컴포넌트들이 기존 import 경로("./learnData")를 유지하도록 타입만 재노출한다.
export type {
  CardNewsTone,
  CardNewsItem,
  LearnTasks,
  LearnTodayChapter,
  LearnHomeData,
} from "@/lib/student-dashboard";
