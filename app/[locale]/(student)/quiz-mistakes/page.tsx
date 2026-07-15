import { NotebookPen, CircleCheck, CircleX } from "lucide-react";
import { LipButton } from "@/components/student-ui";
import { loadQuizMistakes, type QuizMistake } from "@/lib/quiz-mistakes";

// 오답 노트 — AI 과외 채팅의 연습 퀴즈에서 틀린 문항을 날짜별로 모아 열람한다.
// 데이터: quiz_mistakes(student_id 본인). 셸은 (student)/layout.tsx 제공.
// 이웃 페이지(errors)와 동일하게 한국어 문자열을 직접 사용한다.

const SEOUL = "Asia/Seoul";

/** 그룹 키(YYYY-MM-DD, 서울 기준) — 날짜 버킷 정렬/헤더에 사용. */
function seoulDateKey(iso: string): string {
  // en-CA 는 YYYY-MM-DD 포맷을 보장한다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** 날짜 헤더 라벨(예: "2026년 7월 15일 (화)"). */
function seoulDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

interface DateGroup {
  key: string;
  label: string;
  items: QuizMistake[];
}

/** 최신순 오답 목록을 날짜(서울) 버킷으로 그룹핑한다. 입력이 최신순이므로 순서 유지. */
function groupByDate(items: QuizMistake[]): DateGroup[] {
  const groups: DateGroup[] = [];
  const index = new Map<string, DateGroup>();
  for (const item of items) {
    const key = seoulDateKey(item.createdAt);
    let g = index.get(key);
    if (!g) {
      g = { key, label: seoulDateLabel(item.createdAt), items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

function MistakeCard({ item }: { item: QuizMistake }) {
  return (
    <div className="rounded-xl3 border border-hairline bg-white p-4 card-pop">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {item.topic && (
          <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-blue-dark">
            {item.topic}
          </span>
        )}
        {item.chapterNumber != null && (
          <span className="rounded-full bg-ivory px-2 py-0.5 text-[11px] font-medium text-muted">
            {item.chapterNumber}과
          </span>
        )}
      </div>
      <p className="text-[15px] font-bold leading-7 text-ink">{item.prompt}</p>
      <ul className="mt-3 space-y-1.5">
        {item.options.map((opt, oi) => {
          const isAnswer = oi === item.answerIndex;
          const isChosen = oi === item.chosenIndex;
          let cls = "border-hairline bg-white text-muted";
          if (isAnswer) cls = "border-jade bg-jade-soft text-jade-dark";
          else if (isChosen) cls = "border-terra bg-terra-soft text-terra";
          return (
            <li
              key={oi}
              className={`flex items-center gap-2 rounded-xl2 border px-3 py-2 text-sm ${cls}`}
            >
              <span className="flex-1">{opt}</span>
              {isAnswer && <CircleCheck size={16} className="shrink-0 text-jade-dark" aria-hidden />}
              {isChosen && !isAnswer && (
                <CircleX size={16} className="shrink-0 text-terra" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted">
        <span className="text-terra">내 답: {item.options[item.chosenIndex] ?? "—"}</span>
        <span className="text-jade-dark">정답: {item.options[item.answerIndex] ?? "—"}</span>
      </p>
      {item.explanation && (
        <p className="mt-2 border-t border-hairline pt-2 text-sm leading-6 text-bodytx">
          {item.explanation}
        </p>
      )}
    </div>
  );
}

export default async function QuizMistakesPage() {
  const mistakes = await loadQuizMistakes();

  if (mistakes.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-extrabold text-ink">오답 노트</h1>
        <div className="flex flex-col items-center gap-3 rounded-xl3 border border-dashed border-hairline bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-terra-soft text-terra">
            <NotebookPen size={22} aria-hidden />
          </span>
          <p className="text-sm font-bold text-ink">아직 틀린 문제가 없어요</p>
          <p className="text-xs text-muted">
            AI 과외 채팅의 연습 퀴즈에서 틀린 문제가 날짜별로 여기에 모여요.
          </p>
          <LipButton href="/learn">학습 시작하기</LipButton>
        </div>
      </section>
    );
  }

  const groups = groupByDate(mistakes);

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-extrabold text-ink">오답 노트</h1>
        <p className="text-xs text-muted">총 {mistakes.length}문항</p>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          <h2 className="sticky top-0 z-10 -mx-4 bg-ivory/90 px-4 py-1.5 text-xs font-bold text-muted backdrop-blur">
            {g.label} · {g.items.length}문항
          </h2>
          <div className="space-y-3">
            {g.items.map((item) => (
              <MistakeCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
