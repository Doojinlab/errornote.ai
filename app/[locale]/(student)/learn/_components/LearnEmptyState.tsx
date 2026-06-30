"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Card, LipButton } from "@/components/student-ui";

/**
 * 빈 상태(활성 수업 없음) — 행동을 부르는 초대장. 스펙 §5 "빈 상태 재작성".
 * 초대코드 입력 + <LipButton variant="blue">수업 등록하기</LipButton> 를 중앙 카드에.
 * 제출 시 POST /api/enrollments → 성공하면 router.refresh() 로 학습 홈을 다시 그린다.
 */
export default function LearnEmptyState() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const inviteCode = code.trim();
    if (!inviteCode || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "수업 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      // 등록 성공 → 서버 컴포넌트 재요청(활성 수업 화면으로 전환).
      router.refresh();
    } catch {
      setError("네트워크 오류로 등록하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
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
          disabled={pending}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="예: ERR-2025-CHN"
          className="w-full rounded-2xl border border-hairline bg-white px-4 py-3 text-center text-base font-bold tracking-wide text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:border-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/60 disabled:opacity-60"
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-terra-dark">
            {error}
          </p>
        )}
        <LipButton
          variant="blue"
          full
          type="submit"
          className={pending ? "pointer-events-none opacity-70" : ""}
        >
          {pending ? "등록 중…" : "수업 등록하기"}
        </LipButton>
      </form>
    </Card>
  );
}
