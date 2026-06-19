# LTI 1.3 표준 연동 (#47)

Canvas / Moodle 등 LMS와의 IMS Global **LTI 1.3** 표준 통합. 기존 `/api/lms/*` Public API(Phase 3) 위에 LTI 어댑터를 더한다.

> **현재 범위(이 문서 기준): Resource Link 런치 기반.**
> Deep Linking 2.0 · AGS(점수 회신) · NRPS(수강생 동기화) · Canvas/Moodle 인증 시나리오는 후속 작업이다.

## 구성 요소

| 구성 | 위치 |
|---|---|
| 순수 로직(상태/URL/검증/추출) + jose 옵션 서명 검증 | `lib/lti.ts` (+ `lib/lti.test.ts`) |
| 사용자 프로비저닝(issuer+sub → 계정) | `lib/lti-provisioning.ts` (+ `lib/lti-provisioning.test.ts`) |
| 플랫폼 등록 · OIDC state 저장 | `supabase/migrations/20260619000001_lti_platforms.sql` |
| LTI 사용자 매핑 | `supabase/migrations/20260619000002_lti_identities.sql` |
| OIDC 로그인 개시 | `app/api/lti/login/route.ts` |
| 런치(id_token 검증 → 프로비저닝 → 매직링크 세션) | `app/api/lti/launch/route.ts` |
| 도구 공개 JWKS | `app/api/lti/jwks/route.ts` |

## 런치 흐름 (3-legged OIDC)

```
LMS(플랫폼)                         errornote(도구)
   │  1. OIDC 로그인 개시            │
   │  GET/POST /api/lti/login ──────►│  플랫폼 조회 → state/nonce 저장
   │                                 │  302 → 플랫폼 auth_login_url
   │◄────────────────────────────────┤  (scope=openid, response_mode=form_post …)
   │  2. 인증 후 id_token 발급        │
   │  POST /api/lti/launch ─────────►│  state 소비(1회용) → JWKS 서명 검증
   │  (form_post: id_token, state)   │  → iss/aud/exp + nonce + 필수 클레임 검증
   │                                 │  → 런치 컨텍스트 추출 → 앱 진입
```

## 보안 포인트

- **state/nonce 라운드트립**: `lti_login_states`에 1회용으로 저장하고 런치 시 소비(재생 공격 차단).
- **서명 검증**: 플랫폼 `jwks_uri`의 공개키로 `id_token` 서명 검증(`jose.createRemoteJWKSet`), `iss`/`aud`(client_id)/`exp` 확인.
- **클레임 검증**: `message_type` / `version`(1.3.0) / `deployment_id` 일치(`validateLaunchClaims`).
- **테이블 격리**: `lti_platforms` / `lti_login_states`는 RLS enable + 정책 없음 + 권한 회수 → 클라이언트 직접 접근 불가, 라우트(service_role)만 접근.

## 활성화

```bash
npm install jose
```

`.env.local`:
- `LTI_TOOL_PUBLIC_JWK` (선택, Deep Linking/AGS 후속용 도구 JWKS)
- `LTI_TOOL_PRIVATE_KEY` / `LTI_TOOL_KID` (선택, 도구 서명용)

플랫폼 등록(예시, service_role로):

```sql
insert into public.lti_platforms
  (name, issuer, client_id, deployment_id, auth_login_url, auth_token_url, jwks_uri)
values
  ('Canvas Test', 'https://canvas.instructure.com', '<client_id>', '<deployment_id>',
   'https://canvas.instructure.com/api/lti/authorize_redirect',
   'https://canvas.instructure.com/login/oauth2/token',
   'https://canvas.instructure.com/api/lti/security/jwks');
```

LMS 측 도구 등록 URL:
- OIDC 로그인: `{APP_URL}/api/lti/login`
- 런치(redirect): `{APP_URL}/api/lti/launch`
- JWKS: `{APP_URL}/api/lti/jwks`

## 후속 작업 (수용 기준)

- [x] 사용자 프로비저닝: LTI `sub` → errornote 계정 매핑/생성(`lti_identities`) + 매직링크 세션
      (※ 매직링크 세션 수립은 실제 LMS 런치 런타임 검증 필요)
- [x] 컨텍스트 매핑: LTI `context` → `classes` 연결 + 수강 등록 (`lib/lti-context.ts`,
      `lti_context_links`) — 교수자 런치 시 클래스 생성, 학생 런치 시 매핑 클래스에 등록
- [ ] Deep Linking 2.0: 과제 → LMS 임베드(도구 서명 응답)
- [~] AGS: 점수 회신(line item + score) — lib 기반(`lib/lti-ags.ts`): endpoint 파싱·Score
      페이로드·scores URL·토큰/전송(주입형 fetch) 단위 테스트 완료. 잔여: client assertion
      서명(jose, 도구 개인키)·grading 플로우 연동·실 LMS 검증(런북)
- [ ] NRPS: 수강생 명단 동기화
- [ ] Canvas Test SSO + Deep Link + Grade Passback 통과 / Moodle 호환성
- [ ] OpenAPI(`/api/docs`) 갱신
