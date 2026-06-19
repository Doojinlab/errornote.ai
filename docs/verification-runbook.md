# 런타임/실환경 검증 런북

> CI 게이트(typecheck/lint/`test:coverage`)로 커버되지 않고 **실제 외부 시스템·실기기·배포**가
> 있어야 검증되는 항목들의 수동 검증 절차. 각 기능은 단위 테스트로 로직을 검증했고, 여기서는
> 통합·런타임 동작을 확인한다.

---

## 1. LTI 1.3 (Canvas Test / Moodle) — #47

**선행**: `npm install jose`, `lti_platforms`에 플랫폼 등록, `NEXT_PUBLIC_APP_URL` 설정, 배포(공개 URL).

LMS 도구 등록 URL: 로그인 `{APP_URL}/api/lti/login` · 런치 `{APP_URL}/api/lti/launch` · JWKS `{APP_URL}/api/lti/jwks`.

| 시나리오 | 절차 | 기대 |
|---|---|---|
| OIDC 로그인 | LMS에서 도구 실행 | `/api/lti/login`이 302로 플랫폼 `auth_login_url`로 리다이렉트(state/nonce 포함) |
| 런치 검증 | 인증 후 `id_token` form_post | `/api/lti/launch`가 JWKS 서명·iss/aud/exp·nonce·deployment 검증 통과 |
| 프로비저닝 | 첫 런치 | `lti_identities`에 (issuer,sub)→user 생성, `profiles.role` 보정(instructor→professor) |
| 세션 수립 | 런치 완료 | 매직링크로 로그인되어 `/{locale}/learn`(학생) 또는 `/dashboard`(교수)로 진입 |
| context→class | 교수자 런치 | `lti_context_links` 매핑 + `classes` 생성. 이후 학생 런치 시 해당 class에 수강 등록 |
| 재런치 | 같은 사용자 재실행 | 동일 계정/클래스로 들어옴(중복 생성 없음) |

**체크**: 잘못된 서명/만료 토큰 → 401. 위조 nonce → 401. 미등록 플랫폼 → 404.

---

## 2. AI 튜터 tool_use 스트리밍 통합 — #48

**선행**: `lib/tutor-tool-loop.ts`의 `callModel`을 Anthropic `tools`(`TUTOR_TOOLS`) 호출에 바인딩 + 챗 라우트 연동.

| 시나리오 | 절차 | 기대 |
|---|---|---|
| add_to_vocab | 튜터에게 "이 단어 단어장에 넣어줘" | 도구 호출 → `vocabulary`에 본인 행 insert(로그인 학습자 RLS 클라이언트) |
| generate_quiz | "약점 유형 퀴즈 내줘" | 정규화된 객관식 퀴즈 반환(보기≥2, 정답 인덱스 유효) |
| 루프 종료 | 도구 후 후속 응답 | `end_turn`까지 진행, `MAX_TOOL_ROUNDS` 초과 없음 |
| 잘못된 입력 | 모델이 빈 입력 도구 호출 | `isError` tool_result 전달 후 대화 지속(크래시 없음) |

**주의**: `streamText`는 tool_use 미지원 → `complete()` 기반 비스트리밍 경로 또는 스트리밍 tool 이벤트 처리 필요.

---

## 3. Sentry 에러 보고 — #50

**선행**: `npm install @sentry/nextjs`, `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` 설정, 배포.

| 시나리오 | 절차 | 기대 |
|---|---|---|
| 서버 init | 앱 기동 | `instrumentation.ts` `register()`가 Node 런타임에서 Sentry.init |
| 서버 요청 에러 | RSC/Route에서 예외 유발 | `onRequestError`가 Sentry로 보고 |
| 클라이언트 init | 브라우저 진입 | `instrumentation-client.ts`가 Sentry.init |
| 렌더 에러 | 클라이언트 컴포넌트 throw | `app/global-error.tsx`가 Sentry로 보고 |
| 미설정 폴백 | DSN 없이 동작 | 구조적 JSON 콘솔 로그로만 남고 빌드/동작 영향 없음 |

---

## 4. e2e (Playwright RLS) — #54 외

**선행**: `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`(staging 전용 DB).

```bash
npm run test:e2e            # e2e/ 전체
```

핵심 검증: `e2e/rls.spec.ts` — 학생/익명이 타 학생 데이터·`push_subscriptions.subscription` 평문을 읽지 못함, 교수자는 자기 강의만. **운영 DB에서 절대 실행 금지.**

---

## 5. PWA 설치 프롬프트 — #86

**선행**: HTTPS 배포(설치 프롬프트는 보안 컨텍스트 필요).

| 환경 | 절차 | 기대 |
|---|---|---|
| Android/Chrome | 방문 → 배너 "설치" | `beforeinstallprompt` 가로채 네이티브 설치 |
| iOS Safari | 방문 | "공유 → 홈 화면에 추가" 안내 표시(iOS Chrome=CriOS는 미표시) |
| 설치 후 | standalone 재방문 | 배너 비표시(`appinstalled`/standalone 감지) |
| 디스미스 | "나중에" 클릭 후 재방문 | 비표시(localStorage 기억) |
| 설치형 푸시 | iOS 설치 후 알림 허용 | Web Push 수신(미설치 iOS는 불가) |

---

## 6. 프로덕션 빌드 — 공통

CI는 `next build`를 게이트로 돌리지 않는다(typecheck/lint/test만). 배포 전 1회:

```bash
npm run build               # 환경변수(.env.local) 필요
```

next 16 + React 18 + next-intl 빌드 통과, 동적 렌더링(`force-dynamic`) 경고 외 에러 없음 확인.
