-- 今日热词 관심분야 저장 (docs/dashboard-features.md §2.1, §3 관심분야 개인화)
--
-- 학생이 고른 관심분야로 오늘의 단어를 개인화 배포한다. 미설정이면 전 분야에서 신선도 순.
-- 학생 본인만 읽기/쓰기(RLS). append-only.

create table if not exists public.student_hotword_interests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  category    text not null
                check (category in ('game','entertainment','society','economy','daily','meme')),
  created_at  timestamptz not null default now(),
  unique (student_id, category)
);

alter table public.student_hotword_interests enable row level security;

drop policy if exists "student_hotword_interests_self_all" on public.student_hotword_interests;
create policy "student_hotword_interests_self_all"
  on public.student_hotword_interests for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create index if not exists idx_student_hotword_interests_student
  on public.student_hotword_interests (student_id);
