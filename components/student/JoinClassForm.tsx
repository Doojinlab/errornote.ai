"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { LipButton } from "@/components/student-ui";

interface JoinResult {
  classId?: string;
  className?: string;
  alreadyEnrolled?: boolean;
}

interface Props {
  /**
   * 등록 성공 후 콜백. 미지정 시 학습 홈(/learn)으로 이동 + 새로고침한다.
   * (가장 최근 등록이 활성 반이 되므로 해당 수업으로 열린다.)
   */
  onJoined?: (result: JoinResult) => void;
}

/**
 * 교수자 초대코드로 수업에 참여하는 폼(재사용).
 * - 빈 상태(LearnEmptyState) 안전망과 설정 페이지의 "수업 참여" 카드에서 함께 쓴다.
 * - 등록 자체는 POST /api/enrollments(service-role) 가 처리 — 여기선 입력·상태만 담당.
 */
export default function JoinClassForm({ onJoined }: Props) {
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
      const data = (await res.json().catch(() => ({}))) as JoinResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "수업 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setCode("");
      if (onJoined) {
        onJoined(data);
      } else {
        router.push("/learn");
        router.refresh();
      }
    } catch {
      setError("네트워크 오류로 등록하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
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
  );
}
