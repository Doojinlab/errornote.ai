// 학습(홈) 화면 전용 더미 데이터. 서버 연동(Supabase)은 후속 작업에서.
// 스펙: docs/errornote-ui-redesign.md §5 (학습 홈 / 빈 상태).
// ⚠️ 인라인 hex 금지 — tone 값은 디자인 토큰 키만 사용.

export type CardNewsTone = "blue" | "jade" | "gold" | "gem";

export interface CardNewsItem {
  id: string;
  /** 상단 작은 분류 라벨 (예: "이번 주 표현") */
  tag: string;
  title: string;
  /** 중국어 예문 — 렌더 시 font-cn 적용 */
  zh: string;
  tone: CardNewsTone;
}

export interface LearnHomeData {
  studentName: string;
  /** 활성 수업 등록 여부. false → 빈 상태(초대코드) 화면. */
  hasActiveClass: boolean;
  /** 오늘의 목표 진행도 (교정 완료 문장 수) */
  goal: { current: number; total: number };
  streakDays: number;
  gems: number;
  /** "시작하기"가 이어줄 오늘의 학습 */
  today: { chapterId: number; title: string; subtitle: string };
  /** 미니 2-up: 과제 / 동료 리뷰 */
  tasks: {
    assignmentTitle: string;
    assignmentDueInDays: number;
    peerReviewDesc: string;
    peerReviewXp: number;
  };
  cardNews: CardNewsItem[];
}

// 화면 조립용 더미. 추후 서버 컴포넌트에서 실제 데이터로 교체.
export function getLearnHomeData(): LearnHomeData {
  return {
    studentName: "두진",
    hasActiveClass: true,
    goal: { current: 6, total: 10 },
    streakDays: 7,
    gems: 120,
    today: {
      chapterId: 3,
      title: "오늘의 학습 · 3과",
      subtitle: "문장 성분 어순 — 짧은 글 5문장으로 워밍업",
    },
    tasks: {
      assignmentTitle: "주간 작문 과제",
      assignmentDueInDays: 3,
      peerReviewDesc: "친구 글 1편 리뷰하기",
      peerReviewXp: 10,
    },
    cardNews: [
      {
        id: "cn1",
        tag: "이번 주 표현",
        title: "‘把’자문 자연스럽게 쓰기",
        zh: "请把窗户关上。",
        tone: "blue",
      },
      {
        id: "cn2",
        tag: "직역 명문장",
        title: "시간 표현, 이렇게 다듬어요",
        zh: "我们明天上午见面吧。",
        tone: "jade",
      },
      {
        id: "cn3",
        tag: "자주 틀려요",
        title: "‘的 / 得 / 地’ 구분",
        zh: "他跑得很快。",
        tone: "gold",
      },
      {
        id: "cn4",
        tag: "이번 주 보석",
        title: "연속 학습 7일 달성!",
        zh: "坚持就是胜利。",
        tone: "gem",
      },
    ],
  };
}
