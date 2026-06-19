# AI 튜터 고도화 로드맵 (#48)

> 결정 문서. 현 AI 튜터(`app/api/chat`, `lib/prompts/tutor.ts`)는 모델 라우터(#23)·
> dispatchJSON(#31)·1h prompt cache(#22)·HSK 폴백까지 인프라가 완료된 상태다.
> 본 문서는 그 위에 올릴 고도화 범위를 정하고 PR 단위로 분해한다(각 ≤ 500 LOC).

## 현황

- 튜터는 단일 오류 컨텍스트(`errorContext`) + 챕터 번호만 주입한다.
- 멀티턴 대화는 클라이언트가 메시지 배열을 보내는 방식(서버는 stateless).
- 학습자의 **누적 오류 프로필**(반복/화석화 유형, HSK 분포)은 튜터가 모른다 →
  같은 학습자라도 매 대화가 "처음 보는 학생"처럼 동작한다.

## 후보 범위 평가

| 후보 | 가치 | 검증 가능성 | 결정 |
|---|---|---|---|
| A. 멀티턴 컨텍스트 강화(오류 프로필 자동 주입) | 높음(차별화 해자: "내 오류를 아는 튜터") | 백엔드+단위테스트로 완전 검증 | **1순위 — 본 PR** |
| B. Tool use(단어장 자동 추가·퀴즈 생성) | 높음 | 도구 정의·핸들러 단위테스트 가능, 스트리밍 변경 필요 | 2순위 |
| C. 적응형 난이도(성장 곡선 기반) | 중간 | A의 프로필 위에 얹는 형태 | 3순위(A 의존) |
| D. 음성 입출력(발음 연동) | 중간 | UI·브라우저 API 의존, 시각/수동 검증 필요 | 보류(UI 단계) |

## 결정

**A → B → C 순서로 진행.** D(음성)는 발음 UI 작업과 함께 후순위.

근거: A는 errornote의 핵심 차별점(본인 오류 기반 개인화)을 튜터에 직접 연결하고,
순수 백엔드라 이 환경에서 완전히 검증 가능하다. B·C는 A가 만든 학습자 프로필을 재사용한다.

## PR 분해 (진행 상황)

1. ✅ **멀티턴 컨텍스트 강화** (#75, 머지됨)
   - `lib/tutor-context.ts`: 최근 오류 카드 → 학습자 프로필(반복 유형·화석화·HSK 범위) 집계
   - `buildTutorSystemPrompt` 에 학습자 프로필 섹션 주입, `app/api/chat` 자동 주입
2. ✅ **적응형 난이도** — `assessDifficulty`(화석화 부하·HSK 범위 → foundational/standard/
   advanced) + 난이도별 지시 섹션. 프로필 1회 집계로 함께 주입.
   - ※ 원래 3순위였으나, 아래 tool use 가 런타임 검증을 요해 순서를 앞당겼다(순수 로직이라 검증 용이).
3. 🔶 **Tool use** — 도구 계층 분리 구현(검증 가능 부분 완료).
   - ✅ `lib/tutor-tools.ts`: `add_to_vocab`(단어장 insert)·`generate_quiz`(객관식 정규화)
     도구 정의 + 입력 검증 + 핸들러 + 디스패처(`runTutorTool`, 오류를 `isError`로 감쌈).
   - ✅ `lib/tutor-tools.test.ts`: 16 케이스(스키마·검증·핸들러(mock supabase)·디스패치).
   - ⏳ **스트리밍 챗 통합 잔여**: `streamText`(텍스트 전용)는 tool_use 블록을 다루지 못한다.
     `complete()` 기반 tool_use 루프(요청→tool_use→`runTutorTool`→tool_result→재요청) 또는
     스트리밍 tool 이벤트 처리가 필요하며, **실제 Claude API 런타임 검증이 필요** → 검증 가능
     환경에서 진행. 통합 시 `add_to_vocab` 는 로그인 학습자의 RLS 클라이언트로 호출(본인 단어장).

## 비범위(이 트랙 밖)

- 음성 입출력(D): `app/[locale]/(student)/pronunciation` UI 작업과 함께.
- 튜터 대화 영구 저장: 현재 stateless 유지. 필요 시 별도 결정.
