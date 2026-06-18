-- errornote — gamification G3 스트릭 경제 (보호권 + 회복 + 유형별 무사고 + 마일스톤)
-- 설계 근거: docs/gamification-spec.md §2 M2(Streak Economy), §5(Phase G3)
-- 패턴: 20260618000001_gamification_g1_foundation.sql 을 따른다
--   (idempotent DDL, RLS 학생 self + 교수 enrolled, SECURITY DEFINER RPC + auth.uid() 가드).
--
-- 무벌점(no-shame) 원칙(spec §0): 손실회피는 "부드럽게"만 쓴다.
--   - 보호권: 주 1회 자동 지급(상한 2). 하루 결석은 보호권으로 자동 방어 → 죄책감 없는 복귀.
--   - 유형별 무사고 스트릭: "把자문 N일째 무사고" 처럼 실수를 *안 하는 것*을 축하(처벌 아님).

-- ============================================================
-- 1. gamification_stats — 스트릭 경제 컬럼
--    streak_protectors        : 보유 보호권 수(주 1회 자동 지급, 상한 2)
--    last_protector_grant_date : 주간 자동 지급 멱등 추적(해당 ISO 주 시작일 저장)
--    longest_streak           : 최장 연속 스트릭(마일스톤/기록 표시용)
-- ============================================================
alter table public.gamification_stats
  add column if not exists streak_protectors         int  not null default 0,
  add column if not exists last_protector_grant_date date,
  add column if not exists longest_streak            int  not null default 0;

-- ============================================================
-- 2. error_type_streaks — 오류 유형별 무사고 스트릭("把자문 N일째 무사고")
--    쓰기는 RPC(advance_error_type_streak) 경유. 직접 쓰기 정책 없음(=차단, 변조 방지).
-- ============================================================
create table if not exists public.error_type_streaks (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles(id) on delete cascade,
  species_id         uuid not null references public.error_species(id) on delete cascade,
  no_error_days      int  not null default 0,
  best_days          int  not null default 0,
  last_advanced_date date,
  updated_at         timestamptz not null default now(),
  unique (student_id, species_id)
);

create index if not exists idx_error_type_streaks_student
  on public.error_type_streaks (student_id);

-- ============================================================
-- 3. RLS — error_type_streaks
-- ============================================================
alter table public.error_type_streaks enable row level security;

-- 학생 본인 select / 교수자는 enrolled 학생 select (user_dex_entries 정책과 동형).
create policy "error_type_streaks_student_self_select"
  on public.error_type_streaks for select
  using (student_id = auth.uid());

create policy "error_type_streaks_professor_select"
  on public.error_type_streaks for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = error_type_streaks.student_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- 4. grant_weekly_streak_protector — 주 1회 보호권 자동 지급(상한 2)
--    해당 ISO 주(월요일 시작)에 아직 지급 안 했으면 +1, last_protector_grant_date 갱신.
--    멱등: 같은 주 재호출은 granted=false.
-- ============================================================
create or replace function public.grant_weekly_streak_protector(
  p_student_id uuid
) returns table (
  streak_protectors int,
  granted           boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protectors int;
  v_last       date;
  v_week_start date;
  v_granted    boolean := false;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot grant protector for another user';
  end if;

  v_week_start := date_trunc('week', current_date)::date;  -- ISO 주(월요일)

  insert into public.gamification_stats (student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;

  select streak_protectors, last_protector_grant_date
    into v_protectors, v_last
    from public.gamification_stats
    where student_id = p_student_id;

  if v_last is null or v_last < v_week_start then
    v_protectors := least(coalesce(v_protectors, 0) + 1, 2);
    v_granted := true;
    update public.gamification_stats
      set streak_protectors = v_protectors,
          last_protector_grant_date = v_week_start,
          updated_at = now()
      where student_id = p_student_id;
  end if;

  return query select v_protectors, v_granted;
end;
$$;

-- ============================================================
-- 5. consume_streak_protector — 보호권 1 소비(하루 결석 자동 방어 시)
--    보유 0 이면 consumed=false. 0 미만으로 내려가지 않음.
-- ============================================================
create or replace function public.consume_streak_protector(
  p_student_id uuid
) returns table (
  streak_protectors int,
  consumed          boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_protectors int;
  v_consumed   boolean := false;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot consume protector for another user';
  end if;

  select streak_protectors into v_protectors
    from public.gamification_stats
    where student_id = p_student_id;

  if coalesce(v_protectors, 0) > 0 then
    v_protectors := v_protectors - 1;
    v_consumed := true;
    update public.gamification_stats
      set streak_protectors = v_protectors,
          updated_at = now()
      where student_id = p_student_id;
  end if;

  return query select coalesce(v_protectors, 0), v_consumed;
end;
$$;

-- ============================================================
-- 6. advance_error_type_streak — 오류 유형별 무사고 스트릭 갱신
--    p_had_error=true  → 오늘 이 유형에서 오류 발생 → no_error_days 0 으로 리셋
--    p_had_error=false → 오늘 처음 반영이면 no_error_days +1, best_days 갱신
--                        (하루 1회만, last_advanced_date 가드)
-- ============================================================
create or replace function public.advance_error_type_streak(
  p_student_id uuid,
  p_code       text,
  p_had_error  boolean
) returns table (
  no_error_days int,
  best_days     int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_species_id uuid;
  v_days       int;
  v_best       int;
  v_last       date;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot modify streak for another user';
  end if;

  select id into v_species_id from public.error_species where code = p_code;
  if v_species_id is null then
    raise exception 'unknown error_species code: %', p_code;
  end if;

  insert into public.error_type_streaks (student_id, species_id, no_error_days, best_days, last_advanced_date)
  values (
    p_student_id, v_species_id,
    case when p_had_error then 0 else 1 end,
    case when p_had_error then 0 else 1 end,
    current_date
  )
  on conflict (student_id, species_id) do nothing;

  select no_error_days, best_days, last_advanced_date
    into v_days, v_best, v_last
    from public.error_type_streaks
    where student_id = p_student_id and species_id = v_species_id;

  -- insert 가 실제로 반영된 첫 호출이면 last 가 오늘이고 값이 이미 세팅됨 → 그대로 반환.
  if v_last = current_date and (v_days = case when p_had_error then 0 else 1 end) then
    return query select v_days, v_best;
    return;
  end if;

  if p_had_error then
    v_days := 0;
    v_last := current_date;
  elsif v_last is null or v_last < current_date then
    v_days := v_days + 1;
    v_best := greatest(v_best, v_days);
    v_last := current_date;
  end if;  -- 이미 오늘 반영(무사고)이면 변화 없음

  update public.error_type_streaks
    set no_error_days = v_days,
        best_days = v_best,
        last_advanced_date = v_last,
        updated_at = now()
    where student_id = p_student_id and species_id = v_species_id;

  return query select v_days, v_best;
end;
$$;

grant execute on function public.grant_weekly_streak_protector(uuid)      to authenticated;
grant execute on function public.consume_streak_protector(uuid)           to authenticated;
grant execute on function public.advance_error_type_streak(uuid, text, boolean) to authenticated;
