"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card, LipButton } from "@/components/student-ui";

/**
 * 빈 상태(활성 수업 없음) — 행동을 부르는 초대장. 스펙 §5 "빈 상태 재작성".
 * 초대코드 입력 + <LipButton variant="blue">수업 등록하기</LipButton> 를 중앙 카드에.
 * 실제 등록(서버) 연동은 후속 — 지금은 입력 UI만.
 */
export default function LearnEmptyState() {
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // TODO(server): 초대코드로 수업 등록 API 연동. 현재는 플레이스홀더.
  }

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

      <form onSubmit={handleSubmit} className="mt-5 space-y-3 text-left">
        <label htmlFor="invite-code" className="sr-only">
          초대코드
        </label>
        <input
          id="invite-code"
          name="invite-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="예: ERR-2025-CHN"
          className="w-full rounded-2xl border border-hairline bg-white px-4 py-3 text-center text-base font-bold tracking-wide text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60"
        />
        <LipButton variant="blue" full type="submit">
          수업 등록하기
        </LipButton>
      </form>
    </Card>
  );
}
