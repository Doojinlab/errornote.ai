-- 기능 출시 알림 대기자 (docs/dashboard-features.md §1.2)
--
-- 실전 HSK "말하기(곧)"처럼 아직 비활성인 기능에 대해, 학생이 "출시되면 알려줘"를
-- 신청하면 여기에 기록한다. 출시 시 이 명단으로 이메일/인앱 알림을 보낸다.
-- 학생 본인만 읽기/쓰기(RLS). append-only.

create table if not exists public.feature_waitlist (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  feature     text not null,                        -- 예: 'hsk_speaking'
  created_at  timestamptz not null default now(),
  unique (student_id, feature)                       -- 1인 1신청
);

alter table public.feature_waitlist enable row level security;

drop policy if exists "feature_waitlist_self_all" on public.feature_waitlist;
create policy "feature_waitlist_self_all"
  on public.feature_waitlist for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
