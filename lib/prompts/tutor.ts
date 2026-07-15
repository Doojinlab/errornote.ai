import type {
  AnalysisError,
  HskEntryContext,
  HotwordEntryContext,
  WorkspaceEntryMode,
} from '@/types'
import { hskAreaLabel, hskModeLabel } from '@/lib/hsk'

export interface BuildTutorOptions {
  errorContext?: AnalysisError
  chapterNumber?: number
  /** 학습자 오류 프로필 섹션(lib/tutor-context.ts 가 생성). 멀티턴 컨텍스트 강화(#48). */
  learnerProfileSection?: string | null
  /** 적응형 난이도 지시 섹션(lib/tutor-context.ts 가 생성). #48-C. */
  adaptiveDifficultySection?: string | null
  /** 워크스페이스 입장 모드(docs/dashboard-features.md). 있으면 시작 컨텍스트를 주입한다. */
  entryMode?: WorkspaceEntryMode
  hskContext?: HskEntryContext
  hotwordContext?: HotwordEntryContext
}

const TUTOR_ROLE = `당신은 한국 대학 중국어 전공 학부생을 위한 1:1 AI 과외 교수입니다.
- 학습자 모국어: 한국어. 설명은 한국어로, 예문은 중국어로 제시합니다.
- 규범 근거: 《실용현대한어문법》, 《대외한어교학문법》, HSK 급수 체계.
- 말투: 존댓말로 친절하고 담백하게. 과장·칭찬 남용 금지. 정확한 근거(규칙·예문) 제시 우선.
- 답변 구조:
  1) 핵심 규칙 요약 (1~2문장)
  2) 대표 예문 2~3개 (중국어, 필요 시 병음과 한국어 뜻 병기)
  3) 학습자가 바로 시도할 수 있는 짧은 연습 제안 1가지
- 불확실한 영역은 "확실하지 않습니다"라고 솔직히 답하고, 추측으로 단정하지 않습니다.
- 마크다운 코드펜스·과도한 리스트는 지양하고, 읽기 쉬운 문단으로 작성합니다.`

export function buildTutorSystemPrompt(opts: BuildTutorOptions = {}): string {
  const sections: string[] = [TUTOR_ROLE]

  if (typeof opts.chapterNumber === 'number') {
    sections.push(`## 현재 챕터\n학습자는 제${opts.chapterNumber}장을 학습 중입니다.`)
  }

  if (opts.learnerProfileSection) {
    sections.push(opts.learnerProfileSection)
  }

  if (opts.adaptiveDifficultySection) {
    sections.push(opts.adaptiveDifficultySection)
  }

  // ── 워크스페이스 입장 컨텍스트 (docs/dashboard-features.md ★공통 상호작용 모델) ──
  // 새 화면 대신 기존 3분할 워크스페이스를 재사용하고, 채팅 시작 컨텍스트만 분기한다.
  if (opts.entryMode === 'hsk' && opts.hskContext) {
    const { level, area, mode } = opts.hskContext
    sections.push(buildHskEntrySection(level, hskAreaLabel(area), hskModeLabel(mode), area, mode))
  } else if (opts.entryMode === 'hotword' && opts.hotwordContext) {
    sections.push(buildHotwordEntrySection(opts.hotwordContext))
  }

  const err = opts.errorContext
  if (err) {
    sections.push(
      `## 학습자 오류 컨텍스트\n` +
      `- 오류 범위: ${err.error_span}\n` +
      `- 오류 유형: ${err.error_type} — ${err.error_subtype}\n` +
      `- 수정안: ${err.correction}\n` +
      `- 기존 설명: ${err.explanation}\n` +
      `학습자가 이 오류에 대해 추가 질문하면, 위 컨텍스트를 참고하여 답변합니다. ` +
      `단, 학습자의 질문이 이 오류와 무관하면 컨텍스트를 억지로 끼워 맞추지 말고 자유롭게 답변합니다.`
    )
  }

  return sections.join('\n\n')
}

// ── 실전 HSK 입장 (§1) ──
// 저작권상 실제 기출 원문을 재현하지 말고, "기출 유형을 학습한 AI 생성 문제"만 낸다.
function buildHskEntrySection(
  level: number,
  areaLabel: string,
  modeLabel: string,
  area: string,
  mode: string,
): string {
  const head =
    `## 실전 HSK 모드 (입장 컨텍스트)\n` +
    `학습자가 HSK ${level}급 · ${areaLabel} · ${modeLabel}(으)로 실전 훈련에 입장했습니다.\n` +
    `⚠️ 실제 HSK 기출 원문을 그대로 제시하지 마세요. 기출 "유형"을 학습해 새로 생성한 문제만 사용합니다.`

  const areaGuide =
    area === 'writing'
      ? `이 영역은 쓰기(교정 엔진 강점)입니다. 학습자가 문서 작성 창에 답안을 쓰면 [AI 분석]으로 오류 카드가 생성됩니다.`
      : `이 영역은 ${areaLabel}입니다. 지문·문항을 제시하고 학습자의 답을 채점·해설합니다.`

  const modeGuide =
    mode === 'concept'
      ? `개념 학습 모드: 학습자가 자주 틀리는 유형을 이론(규칙·예문)과 함께 짚어주고, 이해 확인용 짧은 문제로 마무리하세요.`
      : `문제 풀이 모드: 실전처럼 한 번에 한 문제씩 내고, 학습자 답을 받은 뒤 정오·해설을 주고 다음 문제로 이어가세요.`

  const opening =
    `첫 응답에서: (1) 이 세션 구성(급수·영역·모드)을 한 줄로 확인하고, ` +
    `(2) HSK ${level}급 ${areaLabel} 유형에 맞는 첫 문제(또는 개념 학습 시 첫 주제)를 바로 제시하세요. ` +
    `쓰기 영역이면 "문서 작성 창에 답안을 작성한 뒤 [AI 분석]을 눌러보세요"라고 안내하세요.`

  return [head, areaGuide, modeGuide, opening].join('\n')
}

// ── 今日热词 입장 (§2.2) ──
// 트렌드 카드는 가볍고 재미 우선 — 뜻을 바로 알려주고 그 단어로 작문을 유도한다.
function buildHotwordEntrySection(hw: HotwordEntryContext): string {
  const facts = [
    `- 표현: ${hw.term}`,
    hw.pinyin ? `- 병음: ${hw.pinyin}` : null,
    hw.literal ? `- 직역: ${hw.literal}` : null,
    hw.meaning ? `- 실제 의미·뉘앙스: ${hw.meaning}` : null,
    hw.example ? `- 예문: ${hw.example}` : null,
    hw.origin ? `- 유래: ${hw.origin}` : null,
    hw.registerTag ? `- 격식도: ${hw.registerTag}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    `## 今日热词 모드 (입장 컨텍스트)\n` +
    `학습자가 오늘의 트렌드 신조어 "${hw.term}"(으)로 입장했습니다. 아래는 이 표현의 정보입니다.\n` +
    `${facts}\n\n` +
    `첫 응답에서: (1) 위 정보를 바탕으로 한국어로 의미·뉘앙스를 짧고 재미있게 알려주고 ` +
    `(격식도가 낮으면 "구어/인터넷 유행어라 시험·격식 글엔 부적절" 같은 주의를 한 줄 덧붙이세요), ` +
    `(2) "이 단어로 문장을 만들어보세요"라고 작문 과제를 냅니다. ` +
    `학습자가 문서 작성 창에 작문하고 [AI 분석]을 누르면 오류 카드가 생성됩니다. ` +
    `트렌드 카드이므로 무겁지 않게, 자연스러운 실사용 예를 곁들이세요.`
  )
}
