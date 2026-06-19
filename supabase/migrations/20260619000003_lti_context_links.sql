-- errornote.ai (#47) — LTI context → errornote class 매핑.
--
-- LTI 런치의 context(강의 컨텍스트)를 errornote classes 에 연결한다.
--   - 교수자 런치: 해당 context 의 class 가 없으면 생성(교수자 = professor_id) + 매핑.
--   - 학생 런치: 매핑된 class 가 있으면 수강 등록, 없으면 보류(교수자가 먼저 셋업).
-- 모든 접근은 라우트 핸들러(service_role)로만. 클라이언트 직접 접근 차단.

create table if not exists public.lti_context_links (
  id         uuid primary key default gen_random_uuid(),
  issuer     text not null,
  context_id text not null,
  class_id   uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issuer, context_id)
);

alter table public.lti_context_links enable row level security;
revoke all on table public.lti_context_links from anon, authenticated;

create index if not exists idx_lti_context_links_class on public.lti_context_links (class_id);
