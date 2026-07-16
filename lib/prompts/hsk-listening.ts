import type { HskLevel } from '@/types'

// 실전 HSK 듣기(听力) 문제 생성 프롬프트.
// ⚠️ 저작권: 실제 기출 원문 금지 — "기출 유형"을 학습한 AI 생성 대본만 만든다.
// 대본은 TTS(ElevenLabs)로 재생되므로 简体字 자연 발화체로 짧게.

const LEVEL_GUIDANCE: Record<HskLevel, string> = {
  3: 'HSK 3급: 아주 쉬운 일상 대화, 짧은 문장 위주. 어휘 600단어 수준.',
  4: 'HSK 4급: 일상·학교·직장 상황의 짧은 대화. 어휘 1200단어 수준.',
  5: 'HSK 5급: 사회·문화 주제의 중간 길이 담화. 어휘 2500단어 수준.',
  6: 'HSK 6급: 논설·전문 주제의 다소 긴 담화. 고급 어휘·성어 포함.',
}

export function buildHskListeningSystem(level: HskLevel): string {
  return [
    '너는 한국 대학 중국어 학습자를 위한 HSK 듣기(听力) 문제 출제자다.',
    LEVEL_GUIDANCE[level],
    '',
    '규칙:',
    '- 저작권: 실제 기출 원문을 쓰지 말고, 기출 "유형"에 맞는 새 문제를 창작한다.',
    '- audio_script: 들려줄 대본. 简体字 자연 발화체. 2~5문장의 짧은 대화 또는 독백.',
    '  화자가 둘이면 각 발화를 "男：…" "女：…" 로 쓰되, 발화마다 반드시 줄바꿈(\\n)으로 나눈다.',
    '  (예: "男：你好。\\n女：你好，请坐。\\n男：谢谢。") 한 줄에 여러 화자를 붙이지 않는다.',
    '  같은 성별 화자가 둘 이상이면 "男1：" "男2：" "女1：" 처럼 번호로 구분한다(성우 배정용).',
    '- question: 대본을 듣고 답할 질문. 실제 HSK 처럼 **중국어(简体字)로만** 쓴다. 한국어 금지.',
    '- options: 4개 보기. 실제 HSK 처럼 **모두 중국어(简体字)로만** 쓴다. 한국어 뜻 병기 금지(예 "炒鱼 (볶은 생선)" 금지 → "炒鱼").',
    '- answer: 반드시 options 중 하나와 글자까지 정확히 일치.',
    '- explanation: 왜 그 답인지 **한국어**로 간단히. 핵심 표현을 짚어준다(여기서만 한국어 사용).',
    '- script_pinyin: audio_script 의 병음(성조부호, 예: nǐ hǎo). 화자표기(男/女)와 줄바꿈은 그대로 둔다.',
    '- script_translation: audio_script 의 자연스러운 **한국어** 번역(화자별 줄바꿈 유지).',
    '',
    '출력은 아래 JSON 객체 하나만. 마크다운·설명 금지:',
    '{"audio_script":"...","script_pinyin":"...","script_translation":"...",',
    '"instructions":"...","question":"...",',
    '"options":["...","...","...","..."],"answer":"...","explanation":"..."}',
  ].join('\n')
}

export function buildHskListeningUserPrompt(level: HskLevel): string {
  return `HSK ${level}급 수준의 듣기 문제 1개를 위 JSON 형식으로 만들어 주세요.`
}
