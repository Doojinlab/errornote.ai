-- errornote — gamification G2 기반: 데일리 퀘스트 (닫힘 루프)
-- 설계 근거: docs/gamification-spec.md §1.2(닫힘 루프), §3(데일리 루프), §4, §5(Phase G2)
--
-- "오늘의 오류 → AI 가 내일 데일리 퀘스트 생성 → 졸업 판정 → 도감"의 첫 데이터 레이어.
-- 한 학습자당 하루 1행. missions 는 AI(dispatchJSON 'daily-quest')가 어제 오류에서
-- 생성한 2분 미션 3개를 담는다. 생성(insert)은 서버(service-role)만, 완료 표시(update)는
-- 본인이 한다. 완료 보상은 activity_coins(코스메틱) 한정 — mastery_points 와 무관.

create table if not exists public.daily_quests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  quest_date  date not null,
  -- 생성 근거(어제 오류 프로필 스냅샷):
  -- { top:[{ code, label, count }], total_errors:int }
  source      jsonb not null default '{}'::jsonb,
  -- AI 생성 미션 3개:
  -- [{ id:string, title:string, instruction:string,
  --    source_code:string|null, source_label:string|null, done:boolean }]
  missions    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (student_id, quest_date)
);

create index if not exists idx_daily_quests_student_date
  on public.daily_quests (student_id, quest_date desc);

alter table public.daily_quests enable row level security;

-- 학생 본인은 자기 퀘스트 select.
create policy "daily_quests_student_self_select"
  on public.daily_quests for select
  using (student_id = auth.uid());

-- 학생 본인은 자기 퀘스트 update(미션 done 표시).
-- 보상은 activity_coins(코스메틱)만 → 직접 조작 위험이 낮아 self-update 허용
-- (XP/스트릭과 동일한 신뢰 모델). mastery_points 는 졸업 플로우 전용이라 무관.
create policy "daily_quests_student_self_update"
  on public.daily_quests for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- insert/delete 는 service-role(생성 경로) 전용. 정책 없음(=차단).
