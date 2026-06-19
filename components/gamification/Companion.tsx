// 误 동반자 상태 표시 — 학생 레이아웃 헤더.
// 프레젠테이션 전용: 단계/문구 계산은 서버 레이아웃(lib/companion.ts + i18n)에서 한다.

interface Props {
  emoji: string;
  title: string;
  /** 무벌점·진척 기반 한 줄 문구(예: "5일째 함께하고 있어요"). */
  subtitle: string;
  ariaLabel: string;
}

export default function Companion({ emoji, title, subtitle, ariaLabel }: Props) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5"
      aria-label={ariaLabel}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <div className="hidden leading-tight sm:block">
        <div className="text-xs font-semibold text-indigo-800">{title}</div>
        <div className="text-[11px] text-indigo-600">{subtitle}</div>
      </div>
    </div>
  );
}
