import { ScanText, Sparkles, Mic, Link2, Languages, FolderOpen, Download, Radio } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { HubGrid, type HubLink } from "@/components/student-ui";
import ToolCard, { type Tool } from "./_components/ToolCard";

const MORE_TOOLS: HubLink[] = [
  { href: "/translate", icon: Languages, title: "번역 비교", desc: "여러 번역 엔진 대조", tone: "blue" },
  { href: "/portfolio", icon: FolderOpen, title: "포트폴리오", desc: "내 글 모아보기", tone: "blue" },
  { href: "/live", icon: Radio, title: "실시간 수업", desc: "진행 중인 수업 참여", tone: "terra" },
  { href: "/data-export", icon: Download, title: "데이터 내보내기", desc: "학습 기록 백업", tone: "blue" },
];

// 도구 허브 — 오류검사 / 발음연습 / URL분석 3종(스펙 §3 도구 탭, §5).
// href 는 기존 학생 라우트로 연결. 각 카드의 사용량(meta)은 본인 활동 집계로 실연동.

/** 본인 도구 사용량 집계(없으면 0). 인증 세션 필요 — 서버에서만 호출. */
async function loadToolUsage(): Promise<{
  errors: number;
  pronunciation: number;
  urls: number;
}> {
  const supabase = createServerClient();
  const user = await getCurrentUser();
  if (!user) return { errors: 0, pronunciation: 0, urls: 0 };

  const [errorsRes, pronRes, urlRes] = await Promise.all([
    supabase
      .from("error_cards")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id),
    supabase
      .from("pronunciation_sessions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id),
    supabase
      .from("url_analysis_logs")
      .select("id", { count: "exact", head: true })
      .eq("student_id", user.id),
  ]);

  return {
    errors: errorsRes.count ?? 0,
    pronunciation: pronRes.count ?? 0,
    urls: urlRes.count ?? 0,
  };
}

export default async function ToolsPage() {
  const usage = await loadToolUsage();

  const tools: Tool[] = [
    {
      href: "/learn",
      icon: ScanText,
      title: "오류 검사",
      desc: "작성한 중국어 문장을 붙여넣으면 오류를 찾아 교정해 드려요.",
      cta: "검사 시작",
      meta: usage.errors > 0 ? `지금까지 ${usage.errors}건 교정` : undefined,
    },
    {
      href: "/quick-ask",
      icon: Sparkles,
      title: "이거 자연스러워?",
      desc: "중국어 문장이 자연스러운지 원어민 친구처럼 즉답해 드려요.",
      cta: "물어보기",
    },
    {
      href: "/pronunciation",
      icon: Mic,
      title: "발음 연습",
      desc: "문장을 따라 읽고 성조·발음 피드백을 받아보세요.",
      cta: "연습 시작",
      meta: usage.pronunciation > 0 ? `${usage.pronunciation}회 연습` : undefined,
    },
    {
      href: "/analyze-url",
      icon: Link2,
      title: "URL 분석",
      desc: "중국어 웹페이지 주소를 넣으면 핵심 표현을 정리해 드려요.",
      cta: "분석 시작",
      meta: usage.urls > 0 ? `${usage.urls}회 분석` : undefined,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-lg font-extrabold text-ink">도구</h1>
        <p className="mt-0.5 text-xs text-muted">학습에 필요한 유틸리티 모음</p>
      </div>

      {tools.map((tool) => (
        <ToolCard key={tool.href} tool={tool} />
      ))}

      <HubGrid title="더 많은 도구" links={MORE_TOOLS} />
    </section>
  );
}
