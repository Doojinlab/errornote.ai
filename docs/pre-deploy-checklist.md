# 사전배포 체크리스트 — errornote.ai (1장 요약)

운영 배포 직전 한눈에 점검하는 체크리스트. 각 항목의 상세 절차는 우측 링크 참고.
권위 있는 원본: 환경변수 [`.env.example`](../.env.example), 배포 절차 [deployment-vercel.md](deployment-vercel.md), 런타임 검증 [verification-runbook.md](verification-runbook.md).

> 순서대로 위→아래로 진행하면 의존 관계가 맞는다(DB·Auth 먼저, 그다음 Vercel, 마지막 스모크).

---

## 0. 코드 게이트 (로컬, 푸시/배포 전)

- [ ] `npm run build` 통과 — CI 는 `next build` 를 게이트로 돌리지 않으므로 **빌드 실패는 Vercel 에서 처음 드러난다**
- [ ] `npm run typecheck` / `npm run lint` 통과
- [ ] `npm run test:coverage` 통과 — CI `verify` 가 커버리지 게이트(lines/stmts/branch)를 강제한다. 로컬 `npm test` 는 게이트 미포함이라 통과해도 CI 실패 가능
- [ ] main(또는 배포 대상) 기준 최신 — `git fetch && git log origin/main` 으로 내 변경이 반영됐는지 확인

## 1. Supabase 운영 프로젝트 → [deployment-vercel.md §1](deployment-vercel.md)

- [ ] 운영 프로젝트 생성
- [ ] 모든 마이그레이션 적용 (`supabase db push`) — append-only, 기존 파일 수정 금지
- [ ] `schema_migrations` 가 로컬 `supabase/migrations/` 와 일치(누락 없음). 타임스탬프 충돌 메모는 `supabase/migrations/README.md` 참고
- [ ] **Settings → API** 3개 키 확보 (URL / anon / service_role)

## 2. 인증 (Google 전용) → [deployment-vercel.md §1-A](deployment-vercel.md)

- [ ] **Google Cloud Console**: OAuth consent screen 게시 + Web OAuth 클라이언트 생성
  - Authorized JavaScript origins: `https://errornote.ai`
  - Authorized redirect URIs: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- [ ] **Supabase → Auth → Providers → Google**: Enable + Client ID/Secret 입력, Callback URL 일치 확인
- [ ] **Supabase → Auth → URL Configuration**: Site URL + Redirect URLs 에 `https://errornote.ai/api/auth/callback` 등록
- [ ] (운영 후) 교수 계정은 `profiles.role` 을 `professor` 로 수동 승격 — 신규 Google 가입 기본 역할은 `student`

## 3. 환경변수 (Vercel → Settings → Environment Variables) → [deployment-vercel.md §3](deployment-vercel.md)

- [ ] **필수**: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY`
- [ ] **강력 권장**: `NEXT_PUBLIC_APP_URL`(운영 도메인) / `CRON_SECRET`(`openssl rand -hex 32`)
- [ ] **선택**(기능별): Resend / Kakao / VAPID / 번역 3엔진 / Sentry / LTI — 쓰는 것만
- [ ] `NEXT_PUBLIC_` 접두사에 시크릿 금지(브라우저 노출). `SUPABASE_TEST_*` 는 운영에 설정하지 않음

## 4. 도메인 / Vercel → [deployment-vercel.md §2·§5](deployment-vercel.md)

- [ ] Vercel 프로젝트에 GitHub `hdj82-bot/errornote.ai` import, Framework=Next.js
- [ ] 운영 도메인 연결 + HTTPS 발급 확인 (PWA 설치 프롬프트는 HTTPS 필요)
- [ ] `NEXT_PUBLIC_APP_URL` / Supabase Site URL / Google origins 의 도메인이 **모두 동일**한지 대조
- [ ] Cron(주간 리포트, `maxDuration: 300`)은 **Vercel Pro 이상** 필요 — 플랜 확인

## 5. 배포 후 스모크 → [deployment-vercel.md §4](deployment-vercel.md)

- [ ] 루트 접속 → `/ko` 로케일 리다이렉트 정상
- [ ] `/ko/login` Google 로그인 → `/api/auth/callback` 성공 → 역할 가드(학생 `/learn`, 교수 `/dashboard`)
- [ ] 학생 글 제출 → `/api/analyze` Claude 오답 카드 반환
- [ ] PWA 설치 프롬프트(HTTPS) — [pwa-ios-validation.md](pwa-ios-validation.md)
- [ ] (cron 설정 시) `/api/cron/weekly-report` 가 `CRON_SECRET` 으로 보호되는지 확인

---

### 배포 블로커 Top 3 (가장 흔한 실패)

1. **Google 프로바이더 미설정** → 로그인 불가. §2 누락이 1순위 블로커.
2. **Redirect URL 불일치** → 로그인 후 거부/`redirect_uri_mismatch`. 도메인 3곳(Vercel env / Supabase / Google) 대조.
3. **`next build` 로컬 미검증** → CI 가 빌드를 안 막으므로 Vercel 에서 처음 터짐. §0 먼저.
