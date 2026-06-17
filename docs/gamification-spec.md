# errornote — 게임화 & 인게이지먼트 설계 스펙

> 제품명: **errornote** (확정) · 도메인: **errornote.ai** (구매 완료)
> 학습자가 **매일 접속해 계속 쓰고 활동하게** 만드는 것이 목표.
> 우선순위: **재미 > 효율**. 단, 과잉 게임화로 내적 동기를 훼손하지 않는다.
> 본 문서는 기존 `Wunote.md` 제품 명세를 보완하는 게임화 레이어 스펙이다.
> 구현은 Claude Code가 §5 로드맵 체크리스트를 하나씩 PR로 처리한다.

---

## 0. 설계 원칙 (모든 메커닉이 따른다)

1. **화이트햇 우선** — 권한 부여·성취·의미·창의로 동기를 만든다. 공포·박탈·FOMO 같은 블랙햇 메커닉은 보조로만, 최소한으로.
2. **무벌점(no-shame)** — 며칠 빠져도 처벌하지 않는다. 误 동반자는 "돌아와서 반가워" 톤. (Finch 모델)
3. **과잉 게임화 경계** — 포인트·가챠가 학습의 *이유*가 되면 내적 동기가 약화된다(자기결정성 이론). 보상은 항상 "실력이 느는 게 보인다"는 내적 진척과 연결한다.
4. **콘텐츠 = 본인의 오류** — 모든 미션/복습/읽기 콘텐츠는 학습자 본인의 오류 프로필에서 생성된다. 이것이 errornote의 해자.
5. **简体字 전용 출력 / CN Red 5% 한도** — 기존 디자인 시스템 규칙 유지(오류 마킹·중국어 콘텐츠에만 CN Red).

---

## 1. 핵심 컨셉

### 1.1 误 동반자 (Companion)
브랜드 마스코트(误 印章 캐릭터)를 **학습자의 오류 여정을 아는 동반자**로 키운다.
- 오류 유형을 졸업시킬수록 **진화**한다(단계별 외형/타이틀).
- 알림·격려 문구는 학습자의 실제 진척을 언급한다. 예: "把자문 28일째 무사고 👏".
- 무벌점: 결석/스트릭 끊김 시 죄책감 푸시 금지. 복귀 환영 톤.
- 연결점: `lib/in-app-notifications.ts`, `lib/kakao.ts`, `lib/webpush.ts`, `lib/prompts/tutor.ts`.

### 1.2 닫힘 루프 (Closed Loop) — 최우선 차별점
**오늘의 오류 → AI가 내일 데일리 퀘스트/드릴 생성 → 졸업 판정 → 도감.**
대부분의 AI 튜터가 "오류를 다음 학습에 반영 못 해 같은 실수가 반복"되는데, errornote는 이 루프가 존재 이유다. UI에서 이 연결을 **명시적으로 보이게** 한다("이 미션은 어제 너의 把자문 오류에서 나왔어").
- 연결점: `lib/fossilization.ts`, `lib/error-cards.ts`, `lib/ai/dispatch.ts`, `app/api/cron/weekly-report`.

---

## 2. 메커닉 카탈로그

각 항목: **개념 / errornote 재해석 / 기존 코드 연결점**.

### M1. 오류 도감 (Error Dex)
- 개념: 오류 유형(把자문·양사·어순·이합사 등)을 수집 가능한 캐릭터/몬스터로.
- 재해석: 틀리면 "误 몬스터 조우", 일정 기간 무사고면 "길들임/도감 등록". 실수가 부끄러움이 아니라 "아직 안 채운 칸"이 된다.
- 연결점: `lib/fossilization.ts`(유형 분류), 신규 `lib/error-dex.ts`, 신규 테이블 `error_species`, `user_dex_entries`.

### M2. 스트릭 경제 (Streak Economy)
- 개념: 손실회피를 부드럽게.
- 재해석:
  - **스트릭 보호권**(주 1회 자동 방어) + **회복권**(끊겼을 때 작은 미션으로 부활).
  - **오류 유형별 스트릭** — "把자문 N일째 무사고". 실수를 *안 하는 것*을 축하.
  - 7/30/100일 마일스톤: confetti + 사운드(`lib/sounds.ts`, Howler.js).
- 연결점: `lib/gamification.ts`, `supabase/migrations/*_gamification.sql`(streak 컬럼 확장).

### M3. 데일리 퀘스트 + 가챠
- 개념: 매일 다른 2분 미션 3개 → 완료 시 변동보상 상자.
- 재해석: 미션은 **어제 오류 기반 AI 생성**(닫힘 루프). 가챠 보상은 사운드팩·테마·아바타 아이템·스티커 등 **코스메틱**(학습 능력엔 영향 없음 → 과금/페이월 압박 회피).
- 연결점: 신규 `lib/daily-quests.ts`, `lib/ai/dispatch.ts`(퀘스트 생성 프롬프트), 신규 테이블 `daily_quests`, `reward_inventory`.

### M4. 이중 화폐 (Dual Currency)
- **활동 화폐(误 도장)**: 쓰면 쌓임. 가챠·코스메틱에 사용. *갈 수 있음.*
- **숙련 화폐(졸업 포인트)**: 오류 유형을 실제로 졸업시켜야만 오름. *갈 수 없음.* 진짜 실력 지표.
- 효과: "안 배우고 포인트만 갈기" 문제 차단. 진척 가시성 = 내적 동기 강화.
- 연결점: `lib/gamification.ts`, 신규 컬럼 `profiles.activity_coins`, `profiles.mastery_points`.

### M5. 에너지 역발상 (Anti-Energy)
- 듀오링고 에너지 시스템(활동할수록 자원 소모, 다크패턴)을 **반대로**.
- errornote: **쓸수록 충전**. 문장 제출/오답 복습이 게이지를 채우고, 그게 가챠·연출로 환원.
- 절대 학습량을 제한하는 자원을 두지 않는다.

### M6. 오답 졸업식 (Error Graduation)
- 자주 틀리던 유형을 마침내 졸업(fossilization 해소)하면 연출·사운드·도감 등록.
- 误 몬스터가 졸업과 함께 *아군*으로 도감에 합류.
- 숙련 화폐 지급 트리거.
- 연결점: `lib/fossilization.ts` → 졸업 이벤트 emit → `lib/gamification.ts`.

### M7. 과거의 나와의 보스전 (SRS Boss)
- 스페이스드 리피티션을 서사화. "3주 전 너를 괴롭힌 这个 오류가 보스로 재등장."
- 연결점: 기존 단어장 SRS 로직 재활용, `app/[locale]/(student)/vocabulary`, 신규 보스전 UI.

### M8. 수업 협동 + 익명 리그 (Class Co-op)
- 메인: **반 전체가 함께 오류 유형 정복**(class 도감, 반 대 반). 긍정적 상호의존(내 활동이 반 목표를 *돕는다*) — 결석이 친구를 *해치는* 부정적 압박은 쓰지 않는다.
- 보조: 익명 닉네임 주간 리그(브론즈→실버→골드). 실명 동기 간 "누가 더 틀렸나" 경쟁은 금지.
- 연결점: `lib/realtime.ts`, 기존 `(professor)/live`, 기존 class 구조, 신규 `class_goals` 테이블.

### M9. 직역 명문장 피드 (Funny Mistakes Feed)
- 한↔중 웃긴 직역/오역을 **익명·동의 기반**으로 "오늘의 명문장" 명예의 전당에.
- 남의 황당한 직역 보는 재미 → 매일 방문 + SNS 공유 동선.
- 연결점: 신규 `lib/feed.ts`, 신규 테이블 `mistake_feed`(opt-in 플래그 필수).

### M10. "이거 자연스러워?" 퀵애스크 (Naturalness Q&A)
- HiNative/Busuu 교정 모델의 errornote판. 낯선 원어민 대신 **AI 즉답 + 선택적 교수 확인**.
- 위축감 주는 톤 금지, 협업 프레이밍.
- 연결점: `lib/ai/dispatch.ts`, 기존 `app/api/chat`, 기존 peer-review.

### M11. 손글씨 획순 + 성조 오류 (Handwriting & Tones)
- 본인 오답에 나온 한자를 그 자리에서 **획순 손글씨 연습**(HSK 시험 대비). Skritter류.
- 발음 기능에 **성조 오류 추적** 추가 → 텍스트 오류와 음성 오류를 같은 프로필로 통합.
- 연결점: 기존 `app/[locale]/(student)/pronunciation`, `lib/pronunciation.ts`, 신규 손글씨 캔버스 컴포넌트.

### M12. 맞춤 그레이디드 리딩 (Targeted Reading)
- AI가 학습자 약점 문법을 일부러 심은 짧은 지문을 본인 HSK 레벨로 생성. 읽기 = 약점 교정.
- 연결점: 기존 `app/[locale]/(student)/analyze-url`, `lib/url-analyze` 프롬프트 재활용, `lib/ai/hsk.ts`.

---

## 3. 데일리 루프 (학생)

```
误 동반자가 맞이 (no-shame)
        ↓
데일리 퀘스트 (어제 오류로 AI 생성·2분 미션 3개)
        ↓
쓰기·제출 → AI 교정 (쓸수록 충전·오류 카드·误 몬스터)
        ↓
즉시 보상 & 복습 도구 (활동 화폐·손글씨·성조·과거 보스전)
        ↓
졸업 & 소셜 (도감 등록·숙련 화폐·반 협동·익명 리그)
        ↓
마무리·예고 (误 진화·스트릭 +1·내일 퀘스트 예고)
        ↓
  ──── 닫힘 루프: 오늘의 오류 → 내일 퀘스트 ────┘
```
误 동반자는 전 과정을 동행하며 무벌점·격려 역할.

---

## 4. 데이터 모델 변경 요약

신규 마이그레이션으로 추가(파일명 예: `supabase/migrations/<ts>_gamification_v2.sql`). 기존 RLS 패턴(`*_rls_policies.sql`) 따라 학생 self / 교수 class-scope 정책 동반 작성.

| 테이블/컬럼 | 용도 |
|---|---|
| `error_species` | 오류 유형 도감 마스터(把자문 등) |
| `user_dex_entries` | 학습자별 도감 수집/졸업 상태 |
| `daily_quests` | 일일 미션(어제 오류 기반 생성 결과) |
| `reward_inventory` | 가챠 코스메틱 보유 |
| `class_goals` | 반 협동 목표 진행도 |
| `mistake_feed` | 직역 피드(opt-in 동의 플래그 필수) |
| `profiles.activity_coins` / `profiles.mastery_points` | 이중 화폐 |
| `streaks` 확장 | 보호권·회복권·유형별 스트릭 |

> 모든 신규 테이블에 RLS 정책 필수. 개인 식별 가능한 직역 피드는 기본 비공개 + 명시 동의 시에만 익명 노출.

---

## 5. 구현 로드맵 (Claude Code 체크리스트)

작은 PR 단위로, 기존 컨벤션(next-intl ko/en/ja, Vitest+Playwright, dispatchJSON)을 따른다.

### Phase G1 — 기반 (동반자 + 화폐)
- [ ] `lib/error-dex.ts` + `error_species`/`user_dex_entries` 마이그레이션 + RLS
- [ ] 이중 화폐 컬럼 + `lib/gamification.ts` 적립/소비 로직 + 단위 테스트
- [ ] 误 동반자 진화 단계 정의 + 상태 컴포넌트(학생 레이아웃 상단)
- [ ] 무벌점 알림 톤으로 `lib/in-app-notifications.ts` 문구 교체

### Phase G2 — 닫힘 루프 (핵심 차별점)
- [ ] `lib/daily-quests.ts`: 어제 오류 → 미션 3개 생성(`dispatchJSON`)
- [ ] 데일리 퀘스트 UI + "이 미션은 어제 너의 ○○ 오류에서 나왔어" 표기
- [ ] 졸업 이벤트: `lib/fossilization.ts` → 숙련 화폐 + 도감 등록 + 졸업식 연출
- [ ] 퀘스트/졸업 e2e 시나리오

### Phase G3 — 리텐션 (스트릭 + 가챠)
- [ ] 스트릭 보호권/회복권/유형별 스트릭
- [ ] 마일스톤 연출(confetti + `lib/sounds.ts`)
- [ ] 가챠 코스메틱 + `reward_inventory`

### Phase G4 — 소셜
- [ ] 반 협동 목표(`class_goals`) + `lib/realtime.ts` 진행 표시
- [ ] 익명 주간 리그
- [ ] 직역 피드(opt-in) — 동의 UX 먼저, 그다음 노출

### Phase G5 — 중국어 특화
- [ ] 손글씨 획순 캔버스(본인 오답 글자 연동)
- [ ] 성조 오류 추적 통합(`lib/pronunciation.ts`)
- [ ] "이거 자연스러워?" 퀵애스크
- [ ] 맞춤 그레이디드 리딩 생성

---

## 6. 안티패턴 (하지 말 것)

- 학습량을 제한하는 에너지/하트류 자원. (M5 참조)
- 결석·스트릭 끊김에 대한 죄책감/처벌 푸시.
- 실명 동기 간 "오류 수" 경쟁 노출.
- 학습 능력에 영향을 주는 유료 가챠(코스메틱만 허용).
- 동의 없는 직역/오류 공개.
- 포인트·배지를 학습의 *목적*으로 만드는 연출(항상 실력 진척과 연결).

---

## 7. 브랜드 리네이밍 (Wunote → errornote) — 확정, 표기 통일 필요

제품명은 **errornote**로 확정(도메인 errornote.ai). 코드/문서에 남은 `Wunote`/`wunote` 표기를 통일한다.

- [ ] `package.json` — `"name": "wunote"` → `"errornote"`
- [ ] `README.md` — 제목/설명의 Wunote.ai → errornote
- [ ] `Wunote.md` — 파일명 및 본문 표기 정리(예: `docs/PRODUCT.md` 또는 `errornote.md`로 이동 고려)
- [ ] i18n 메시지(`messages/{ko,en,ja}.json`)의 표기
- [ ] 메타데이터/manifest(`app/layout.tsx`, PWA manifest, OG 태그 등)
- [ ] 도메인/URL 환경변수(`NEXT_PUBLIC_APP_URL` 등) errornote.ai 반영

> 게임화 착수(G1) 전이나 병행으로 처리 권장. 별도 PR로 분리해 리뷰를 깔끔하게.

---

## 8. 다음 작업 (내일 이어서)

오늘 세션에서 합의했으나 작성은 보류한 항목. 내일 착수.

- [ ] §4 데이터 모델 → 실제 **Supabase 마이그레이션 SQL** 작성(테이블 + RLS 정책 포함)
- [ ] G2 닫힘 루프: **퀘스트 생성 프롬프트** + `dispatchJSON('daily-quest')` **호출부 초안**
- [ ] 미머지 브랜치 5개 정리 후 `feat/gamification-loop` 시작
  (security/lms-api-hardening, feat/phase4-cron-observability, feat/lighthouse-ci, feat/mobile-nav-polish, docs/pwa-ios-validation)
