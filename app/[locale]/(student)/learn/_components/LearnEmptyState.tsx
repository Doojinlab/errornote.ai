import { GraduationCap } from "lucide-react";
import { Card } from "@/components/student-ui";
import JoinClassForm from "@/components/student/JoinClassForm";

/**
 * 빈 상태(활성 수업 없음) — 안전망.
 * 이제 모든 학생은 개인 자기주도 학습반이 자동 배정되므로(마이그레이션
 * 20260704000001) 이 화면은 거의 나타나지 않는다. 배정 실패 등 예외 상황에서
 * 초대코드 등록 경로를 잃지 않도록 남겨 둔다. 입력 로직은 JoinClassForm 재사용.
 */
export default function LearnEmptyState() {
  return (
    <Card className="px-6 py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-soft text-blue">
        <GraduationCap size={30} aria-hidden />
      </div>

      <h1 className="mt-4 text-lg font-extrabold text-ink">
        아직 등록된 수업이 없어요
      </h1>
      <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-bodytx">
        교수자에게 받은 초대코드를 입력하면 바로 시작할 수 있어요.
      </p>

      <div className="mt-5">
        <JoinClassForm />
      </div>
    </Card>
  );
}
