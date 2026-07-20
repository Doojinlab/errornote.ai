// 실전 HSK 문제 생성 프롬프트 — 유형별 템플릿 (docs/dashboard-features.md §1, §3)
//
// ⚠️ 저작권: 실제 HSK 기출(汉考国际/HANBAN) 원문을 재현·저장 금지.
//    "기출 유형"만 학습해 새로 생성한 문제를 만든다.

import type { HskArea, HskLevel, HskMode } from '@/types'
import { hskAreaLabel } from '@/lib/hsk'

// 급수별 난이도 가이드(어휘·문형 범위)를 한 줄로 압축.
const LEVEL_GUIDE: Record<HskLevel, string> = {
  3: 'HSK 3급: 600단어 수준. 기초 일상 화제, 짧고 평이한 문장.',
  4: 'HSK 4급: 1200단어 수준. 일상·학업·직장 화제, 복문과 기본 관용표현.',
  5: 'HSK 5급: 2500단어 수준. 사회·문화·시사 화제, 서면어와 성어 일부.',
  6: 'HSK 6급: 5000단어+ 수준. 추상·전문 화제, 성어·서면어·함축 의미.',
}

// 영역·유형별 출제 템플릿(기출 "유형"만). 모델이 이 구조를 따라 새 문제를 만든다.
// 듣기(listening)는 lib/hsk-listening 로 별도 생성한다. 여기 템플릿은 독해·쓰기 전용.
const AREA_TEMPLATES: Record<'reading' | 'writing', string> = {
  reading: [
    '독해 유형 중 하나를 골라 출제:',
    '· 지문이해: 3~5문장 지문(passage) + 내용 일치/주제/세부정보 4지선다(options 4개, answer 1개).',
    '· 빈칸채우기: 한 문장에 빈칸, 문맥에 맞는 어휘/접속사 4지선다.',
    '· 문장독해: 짧은 지문 뒤 밑줄 어휘의 의미를 4지선다.',
    'options 는 정확히 4개, answer 는 options 중 정답 문자열과 동일하게.',
  ].join('\n'),
  writing: [
    '쓰기 유형 중 하나를 골라 출제:',
    '· 어순배열: 제시어(词语) 4~6개를 주고 올바른 문장으로 배열(prompt 에 제시어, answer 에 정답 문장).',
    '· 제시어작문: 주어진 단어 1~2개로 문장/짧은 글 만들기(작문은 학습자가 문서 작성 창에 작성 → [AI 분석]).',
    '· 주제작문(5급+): 짧은 주제문 제시, 80자 내외 작문 과제.',
    'options 는 비우고, answer 에는 모범답안 또는 핵심 채점 포인트를 담는다.',
  ].join('\n'),
}

const MODE_GUIDE: Record<HskMode, string> = {
  practice: '문제 풀이 모드: 실전처럼 한 문제만 낸다(간결한 지시문 + 문제).',
  concept:
    '개념 학습 모드: 해당 유형에서 학습자가 자주 틀리는 포인트를 짧게 이론 설명(explanation)한 뒤, 이해 확인용 문제 1개를 낸다.',
}

/** 구조화된 HSK 문제 생성용 시스템 프롬프트. dispatchJSON 과 함께 쓴다. */
export function buildHskGenerationSystem(
  level: HskLevel,
  area: HskArea,
  mode: HskMode,
): string {
  const areaKey: 'reading' | 'writing' = area === 'writing' ? 'writing' : 'reading'
  return [
    '당신은 한국 대학생을 위한 HSK 출제 전문가입니다. 기출 "유형"만 학습해 새 문제를 만듭니다.',
    '⚠️ 실제 HSK 기출 원문을 그대로 재현하지 마세요. 저작권 대상입니다.',
    LEVEL_GUIDE[level],
    `영역: ${hskAreaLabel(area)}`,
    AREA_TEMPLATES[areaKey],
    MODE_GUIDE[mode],
    '',
    '출력: 아래 스키마의 유효한 JSON 객체 하나만. 마크다운·설명 금지.',
    '{',
    `  "type": "유형 키(예: 독해-지문이해, 쓰기-어순배열)",`,
    '  "instructions": "학습자에게 보여줄 한국어 지시문",',
    '  "passage": "독해 지문(중국어). 없으면 생략",',
    '  "prompt": "문제 본문(중국어 또는 혼합)",',
    '  "options": ["보기1","보기2","보기3","보기4"],  // 객관식일 때만',
    '  "answer": "정답 보기 또는 모범답안/채점 포인트",',
    '  "explanation": "해설(한국어)"',
    '}',
  ].join('\n')
}

export function buildHskGenerationUserPrompt(level: HskLevel, area: HskArea): string {
  return `HSK ${level}급 ${hskAreaLabel(area)} 영역의 새 문제를 하나 생성해줘.`
}
