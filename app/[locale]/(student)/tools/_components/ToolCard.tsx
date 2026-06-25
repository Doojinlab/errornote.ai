import { Card, LipButton } from "@/components/student-ui";
import { ArrowRight, type LucideIcon } from "lucide-react";

export interface Tool {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  cta: string;
}

/**
 * 도구 허브 카드 1개. 스펙 §5: card-pop 카드 + LipButton 진입.
 * 색 규칙: 유틸리티는 교정/연속학습/마감과 무관하므로 일반 액션색 blue만 사용
 * (jade=교정, gold=연속학습, terra=오류/마감 전용이라 장식으로 쓰지 않음).
 */
export default function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 bg-blue-soft text-blue">
          <Icon size={22} aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-ink">{tool.title}</h2>
          <p className="mt-0.5 text-sm text-bodytx">{tool.desc}</p>
        </div>
      </div>

      <LipButton
        href={tool.href}
        variant="blue"
        full
        className="mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
      >
        {tool.cta}
        <ArrowRight size={18} aria-hidden />
      </LipButton>
    </Card>
  );
}
