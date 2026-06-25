import { ScanText, Mic, Link2 } from "lucide-react";
import ToolCard, { type Tool } from "./_components/ToolCard";

// 도구 허브 — 오류검사 / 발음연습 / URL분석 3종(스펙 §3 도구 탭, §5).
// href 는 기존 학생 라우트로 연결(데이터는 더미, 진입 동선만 시안).
const TOOLS: Tool[] = [
  {
    href: "/learn",
    icon: ScanText,
    title: "오류 검사",
    desc: "작성한 중국어 문장을 붙여넣으면 오류를 찾아 교정해 드려요.",
    cta: "검사 시작",
  },
  {
    href: "/pronunciation",
    icon: Mic,
    title: "발음 연습",
    desc: "문장을 따라 읽고 성조·발음 피드백을 받아보세요.",
    cta: "연습 시작",
  },
  {
    href: "/analyze-url",
    icon: Link2,
    title: "URL 분석",
    desc: "중국어 웹페이지 주소를 넣으면 핵심 표현을 정리해 드려요.",
    cta: "분석 시작",
  },
];

export default function ToolsPage() {
  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-lg font-extrabold text-ink">도구</h1>
        <p className="mt-0.5 text-xs text-muted">학습에 필요한 유틸리티 모음</p>
      </div>

      {TOOLS.map((tool) => (
        <ToolCard key={tool.href} tool={tool} />
      ))}
    </section>
  );
}
