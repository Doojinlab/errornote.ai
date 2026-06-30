# Vercel 배포 가이드 — errornote.ai

Next.js 16 (App Router) + Supabase 스택을 Vercel에 배포하는 절차와 환경변수 체크리스트.
빌드 게이트(`typecheck`/`lint`/`next build`)는 통과 상태이며, 이 문서는 **운영 환경 연결**에 집중한다.

> 사전 점검: 배포 전 1회 로컬에서 `npm run build` 가 통과하는지 확인한다([verification-runbook.md](verification-runbook.md) §6).
> CI 는 `next build` 를 게이트로 돌리지 않으므로(typecheck/lint/test 만), 빌드 실패는 Vercel 에서 처음 드러날 수 있다.

---

## 1. 선행 조건 (Supabase 운영 프로젝트)

Vercel 배포는 동작하는 Supabase 운영 프로젝트를 전제로 한다.

1. [app.supabase.com](https://app.supabase.com) 에서 운영 프로젝트 생성
2. `supabase/migrations/` 의 모든 마이그레이션을 운영 DB 에 적용
   ```bash
   supabase link --project-ref <PROJECT_REF>
   supabase db push          # migrations/ 의 SQL 을 운영 DB 에 반영
   ```
   > 마이그레이션 파일은 append-only — 절대 수정하지 않는다(CLAUDE.md 참고).
3. **Settings → API** 에서 아래 3개 값을 확보한다(2번 환경변수에서 사용):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 노출 금지)
4. **Authentication → URL Configuration**
   - **Site URL**: 운영 도메인 (예: `https://errornote.ai`)
   - **Redirect URLs**(allowlist)에 앱 콜백을 추가한다. 미등록 시 로그인 후 리다이렉트가 거부된다:
     - `https://errornote.ai/api/auth/callback`
     - 로컬 개발용 `http://localhost:3000/api/auth/callback` (선택)
   - 와일드카드가 필요하면 `https://errornote.ai/**` 형태로 등록한다.

---

## 1-A. Google OAuth 프로바이더 설정 (로그인 필수)

로그인/회원가입은 **Google OAuth 전용**이다(`app/[locale]/(auth)/login/LoginForm.tsx` 의 `signInWithOAuth({ provider: 'google' })`).
아래 설정이 누락되면 운영에서 **로그인 자체가 동작하지 않는다(배포 블로커)**. Google Client ID/Secret 은 앱 env 가 아니라 **Supabase 대시보드**에 입력한다.

로그인 흐름(2단 리다이렉트):
`앱 → Supabase authorize → Google 동의 → Supabase /auth/v1/callback → 앱 /api/auth/callback(코드 교환)`

### (1) Google Cloud Console — OAuth 클라이언트 생성

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 선택/생성
2. **APIs & Services → OAuth consent screen** 구성(External, 앱 이름·지원 이메일·도메인). 운영 전 게시(Publish) 권장 — Testing 상태면 등록한 테스트 사용자만 로그인 가능.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `https://errornote.ai`
   - **Authorized redirect URIs**: **Supabase 콜백** 을 등록한다(앱 콜백이 아님):
     - `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     - 정확한 값은 아래 (2) Supabase Google 프로바이더 화면에 그대로 표시된다 — 복사해 붙여넣는다.
4. 생성된 **Client ID** 와 **Client Secret** 을 확보한다.

### (2) Supabase — Google 프로바이더 활성화

1. **Authentication → Providers → Google** → **Enable** 토글 ON
2. (1)에서 얻은 **Client ID** / **Client Secret** 입력 후 저장
3. 화면에 표시된 **Callback URL (for OAuth)** = `https://<PROJECT_REF>.supabase.co/auth/v1/callback` 이 (1)-3 의 Authorized redirect URIs 와 **정확히 일치**하는지 확인

### (3) 동작 확인

- 운영 도메인 `/login` → "Google 계정으로 계속하기" 클릭 → Google 동의 → `/learn`(학생) 또는 `/dashboard`(교수)로 진입하면 성공.
- 신규 Google 사용자는 DB 트리거 `handle_new_user()` 가 `profiles` 행을 생성하며 **기본 역할은 `student`**, 이름은 Google 프로필에서 채워진다. 교수 계정은 가입 후 DB 에서 `profiles.role` 을 `professor` 로 수동 승격한다.

> 흔한 실패: (a) Redirect URI 불일치(`redirect_uri_mismatch`) → (1)-3 ↔ (2)-3 값 대조, (b) 앱 콜백 미등록 → §1-4 Redirect URLs 에 `/api/auth/callback` 추가, (c) consent screen Testing 상태 → 게시 또는 테스트 사용자 등록.

---

## 2. Vercel 프로젝트 연결

1. [vercel.com/new](https://vercel.com/new) → GitHub `hdj82-bot/errornote.ai` import
2. Framework Preset: **Next.js** (자동 감지). Build Command / Output 은 기본값 사용.
3. 환경변수 입력 후 **Deploy**.

별도 `vercel.json` 의 빌드 오버라이드는 없다 — cron 과 함수 `maxDuration` 만 정의되어 있다(5번 참고).

---

## 3. 환경변수 체크리스트

Vercel **Settings → Environment Variables** 에 입력한다. 권위 있는 원본은 [`.env.example`](../.env.example).
`NEXT_PUBLIC_` 접두사 변수는 브라우저에 노출되므로 시크릿(서비스 롤 키 등)에는 절대 쓰지 않는다.

### 필수 — 미설정 시 앱이 뜨지 않음

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS 적용, 브라우저 안전) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key — 서버 전용, RLS 우회 |
| `ANTHROPIC_API_KEY` | Claude API 키 (`lib/claude.ts`) |

### 강력 권장 — 운영에서 사실상 필요

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_APP_URL` | 운영 도메인 (예: `https://errornote.ai`). 이메일 링크·카카오 리다이렉트·LTI URL 기준. 기본값은 `http://localhost:3000` 이므로 **반드시 운영 값으로 덮어쓴다** |
| `CRON_SECRET` | 주간 리포트 cron 인증 시크릿. `openssl rand -hex 32` 로 생성. 미설정 시 cron 엔드포인트 보호 약화 |

### 선택 — 미설정 시 해당 기능만 비활성 (graceful degrade)

| 변수 | 기능 |
|---|---|
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | 주간 카드뉴스 이메일 발송 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` / `NEXT_PUBLIC_KAKAO_REDIRECT_URI` / `KAKAO_TOKEN_ENCRYPTION_KEY` | 카카오 알림(OAuth). 리다이렉트 URI 는 카카오 앱 설정에도 동일 등록 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `WEB_PUSH_SUBJECT` | PWA Web Push (`npx web-push generate-vapid-keys`) |
| `DEEPL_API_KEY` / `PAPAGO_CLIENT_ID` / `PAPAGO_CLIENT_SECRET` / `OPENAI_API_KEY` / `OPENAI_TRANSLATE_MODEL` | 역방향 번역 비교(3엔진 병렬, 미설정 엔진은 생략) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_TRACES_SAMPLE_RATE` | 에러 모니터링. 활성화하려면 `npm install @sentry/nextjs` 선행. 미설정 시 구조적 JSON 로그로만 남음 |
| `ANTHROPIC_LOG_USAGE` | Claude 토큰/비용 상세 로그(`1`=on) |
| `SUPABASE_REALTIME_CONCURRENT_LIMIT` | Realtime 동시연결 경보 임계(free≈200, pro≈500, 기본 200) |
| `LTI_TOOL_PUBLIC_JWK` / `LTI_TOOL_PRIVATE_KEY` / `LTI_TOOL_KID` / `LTI_DL_SECRET` | LTI 1.3 (Canvas/Moodle). 런치 검증엔 `npm install jose` 선행([lti-1.3.md](lti-1.3.md)) |

> `SUPABASE_TEST_URL` / `SUPABASE_TEST_ANON_KEY` 는 E2E(RLS) 전용으로 **운영에 설정하지 않는다**. 운영 DB 에서 e2e 실행 금지.

---

## 4. 배포 후 스모크 체크

- [ ] 운영 도메인 루트 접속 → 로케일 리다이렉트(`/ko`) 정상
- [ ] `/ko/login` "Google 계정으로 계속하기" → Google 동의 → 콜백(`/api/auth/callback`) 로그인 성공 (§1-A)
- [ ] 로그인 후 역할 가드 동작(학생→`/learn`, 교수→`/dashboard`) — `proxy.ts`
- [ ] 학생 글 제출 → `/api/analyze` 에서 Claude 오답 카드 반환
- [ ] PWA: HTTPS 에서 설치 프롬프트 노출([pwa-ios-validation.md](pwa-ios-validation.md))

전체 런타임/실환경 검증 항목은 [verification-runbook.md](verification-runbook.md) 참고.

---

## 5. Vercel Cron — 주간 리포트

`vercel.json` 에 정의됨:

```jsonc
{
  "crons": [{ "path": "/api/cron/weekly-report", "schedule": "0 0 * * 1" }],
  "functions": { "app/api/cron/weekly-report/route.ts": { "maxDuration": 300 } }
}
```

- 스케줄: 매주 월요일 00:00 UTC = **09:00 KST**.
- `maxDuration: 300`(초) — 클래스/학생 직렬 처리 + 학생당 Claude 1회 호출을 고려한 상한. **Vercel Pro 이상**에서만 300초 함수가 허용된다(Hobby 플랜은 한도가 낮음).
- 인증: 라우트가 `CRON_SECRET` 을 검증한다(`Authorization: Bearer <CRON_SECRET>` 또는 `?secret=`). Vercel Cron 은 `CRON_SECRET` 설정 시 자동으로 Bearer 헤더를 붙인다.

---

## 6. 알려진 경고 (배포 차단 아님)

`next build` 시 다음 경고가 나오지만 빌드는 성공하며 동작에 영향 없다:

- **Sentry 동적 import 2건** (`app/global-error.tsx`, `instrumentation-client.ts`) — `@sentry/nextjs` 미설치 시의 의도된 회피 코드. Sentry 를 쓰려면 패키지를 설치한다.
> `middleware` → `proxy` 이전은 완료됨(`proxy.ts`). Next.js 16 deprecation 경고 해소.

---

## 7. 참고

- **사전배포 체크리스트(1장 요약)**: [pre-deploy-checklist.md](pre-deploy-checklist.md)
- 로컬 개발 셋업·명령어: [../CLAUDE.md](../CLAUDE.md)
- 환경변수 원본: [../.env.example](../.env.example)
- 런타임 검증 런북: [verification-runbook.md](verification-runbook.md)
