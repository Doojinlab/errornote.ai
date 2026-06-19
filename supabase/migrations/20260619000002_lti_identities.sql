-- errornote.ai (#47) — LTI 사용자 매핑(프로비저닝).
--
-- LTI 런치의 subject(issuer + sub)를 errornote 계정(profiles.id)에 연결한다.
-- 한 번 매핑되면 이후 같은 LMS 사용자의 런치는 동일 계정으로 들어온다.
-- 모든 접근은 라우트 핸들러(service_role)로만. 클라이언트 직접 접근 차단.

create table if not exists public.lti_identities (
  id         uuid primary key default gen_random_uuid(),
  issuer     text not null,
  sub        text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issuer, sub)
);

alter table public.lti_identities enable row level security;
revoke all on table public.lti_identities from anon, authenticated;

create index if not exists idx_lti_identities_user on public.lti_identities (user_id);
