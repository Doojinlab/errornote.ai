-- errornote.ai (#47) — LTI 1.3 플랫폼 등록 + OIDC 로그인 state 저장.
--
-- LTI 1.3 표준 연동(Canvas/Moodle)의 런치 기반.
--   - lti_platforms     : 신뢰하는 LMS 플랫폼 등록(issuer/client_id/deployment + 엔드포인트).
--   - lti_login_states  : OIDC 3-legged 로그인의 state/nonce 라운드트립 검증(1회용).
--
-- 모든 LTI 흐름은 라우트 핸들러(service_role)로만 수행한다. 클라이언트(anon/authenticated)는
-- 이 테이블에 직접 접근할 수 없다(RLS enable + 정책 없음 + 권한 회수 → 전면 차단).
-- 플랫폼 등록 관리 UI(교수자 소유 정책)는 후속 작업.

-- ============================================================
-- 1. lti_platforms — 신뢰 플랫폼 등록
-- ============================================================
create table if not exists public.lti_platforms (
  id             uuid primary key default gen_random_uuid(),
  professor_id   uuid references public.profiles(id) on delete set null,
  class_id       uuid references public.classes(id) on delete set null,
  name           text not null,
  issuer         text not null,
  client_id      text not null,
  deployment_id  text,
  auth_login_url text not null,
  auth_token_url text not null,
  jwks_uri       text not null,
  created_at     timestamptz not null default now(),
  unique (issuer, client_id, deployment_id)
);

-- ============================================================
-- 2. lti_login_states — OIDC state/nonce(1회용, 짧은 수명)
-- ============================================================
create table if not exists public.lti_login_states (
  state      text primary key,
  nonce      text not null,
  issuer     text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. RLS — 전면 차단(정책 없음). service_role 만 접근(라우트 핸들러).
-- ============================================================
alter table public.lti_platforms    enable row level security;
alter table public.lti_login_states enable row level security;

revoke all on table public.lti_platforms    from anon, authenticated;
revoke all on table public.lti_login_states from anon, authenticated;

-- ============================================================
-- 4. 인덱스
-- ============================================================
create index if not exists idx_lti_platforms_issuer
  on public.lti_platforms (issuer, client_id);
create index if not exists idx_lti_login_states_created
  on public.lti_login_states (created_at);
