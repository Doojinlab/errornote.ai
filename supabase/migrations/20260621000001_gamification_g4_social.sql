-- errornote — gamification G4 소셜 (반 협동 목표 + 익명 리그 + 직역 피드)
-- 설계 근거: docs/gamification-spec.md §2 M8(Class Co-op), M9(Funny Mistakes Feed), §5 Phase G4
-- 패턴: 20260618000001_gamification_g1_foundation.sql 을 따른다.
--
-- 화이트햇/무벌점 원칙(spec §0, §6):
--   - 반 협동: 긍정적 상호의존(내 활동이 반 목표를 *돕는다*). 결석이 친구를 해치는 압박 금지.
--   - 익명 리그: 익명 닉네임만 노출. 실명 간 "누가 더 틀렸나" 경쟁 금지.
--   - 직역 피드: 기본 비공개. **명시 동의(is_public)** 시에만 익명으로 노출.

-- ============================================================
-- 1. class_goals — 반 전체가 함께 정복하는 오류 유형 목표
--    교수자가 생성. 학생 기여는 RPC(contribute_class_goal) 경유(긍정적 상호의존).
-- ============================================================
create table if not exists public.class_goals (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  species_id    uuid not null references public.error_species(id) on delete cascade,
  title         text not null default '',
  target_count  int  not null check (target_count > 0),
  current_count int  not null default 0,
  period_start  date not null,
  period_end    date not null,
  achieved      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_class_goals_class_period
  on public.class_goals (class_id, period_end);

alter table public.class_goals enable row level security;

-- 읽기: 수강생(enrolled) + 담당 교수. 쓰기(생성/수정/삭제): 담당 교수만.
create policy "class_goals_member_select"
  on public.class_goals for select
  using (public.is_enrolled(class_id) or public.owns_class(class_id));

create policy "class_goals_professor_insert"
  on public.class_goals for insert
  with check (public.owns_class(class_id));

create policy "class_goals_professor_update"
  on public.class_goals for update
  using (public.owns_class(class_id));

create policy "class_goals_professor_delete"
  on public.class_goals for delete
  using (public.owns_class(class_id));

-- contribute_class_goal — 수강생이 해당 유형을 졸업/개선했을 때 반 목표에 +1 기여.
-- 호출자는 해당 class 에 enrolled 여야 한다. current_count 가 target 도달 시 achieved.
create or replace function public.contribute_class_goal(
  p_class_id uuid,
  p_code     text
) returns table (
  current_count int,
  target_count  int,
  achieved      boolean
) language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_species_id uuid;
  v_goal       public.class_goals%rowtype;
begin
  if not public.is_enrolled(p_class_id) then
    raise exception 'permission denied: not enrolled in class';
  end if;

  select id into v_species_id from public.error_species where code = p_code;
  if v_species_id is null then
    raise exception 'unknown error_species code: %', p_code;
  end if;

  -- 현재 기간의 활성 목표 1건(가장 임박한 마감) 선택, 잠금.
  select * into v_goal
    from public.class_goals
    where class_id = p_class_id
      and species_id = v_species_id
      and current_date between period_start and period_end
    order by period_end asc
    limit 1
    for update;

  if v_goal.id is null then
    -- 해당 유형의 활성 반 목표가 없으면 조용히 no-op(기여 대상 없음).
    return query select 0, 0, false;
    return;
  end if;

  update public.class_goals
    set current_count = current_count + 1,
        achieved = (current_count + 1) >= target_count
    where id = v_goal.id
    returning current_count, target_count, achieved
    into v_goal.current_count, v_goal.target_count, v_goal.achieved;

  return query select v_goal.current_count, v_goal.target_count, v_goal.achieved;
end;
$$;

-- ============================================================
-- 2. league_points — 익명 주간 리그 포인트(주차·반 단위)
--    적립은 RPC(add_league_points) 경유. 표준 조회는 RPC(get_league_standings)로
--    *익명화*해서만 노출(직접 select 정책 없음 → 타인 식별 차단).
-- ============================================================
create table if not exists public.league_points (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  week_start  date not null,
  points      int  not null default 0,
  updated_at  timestamptz not null default now(),
  unique (student_id, class_id, week_start)
);

create index if not exists idx_league_points_class_week
  on public.league_points (class_id, week_start);

alter table public.league_points enable row level security;

-- 본인 행만 직접 select 허용(내 포인트 확인용). 타인 포인트는 RPC 익명 집계로만.
create policy "league_points_self_select"
  on public.league_points for select
  using (student_id = auth.uid());

create or replace function public.add_league_points(
  p_student_id uuid,
  p_class_id   uuid,
  p_week_start date,
  p_points     int
) returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_points int;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot add league points for another user';
  end if;

  insert into public.league_points (student_id, class_id, week_start, points)
  values (p_student_id, p_class_id, p_week_start, greatest(coalesce(p_points, 0), 0))
  on conflict (student_id, class_id, week_start) do update
    set points = public.league_points.points + greatest(coalesce(p_points, 0), 0),
        updated_at = now()
  returning points into v_points;

  return v_points;
end;
$$;

-- get_league_standings — 반·주차 순위를 *익명화*해 반환.
-- 호출자는 enrolled 여야 한다. 타인의 student_id 는 노출하지 않고,
-- 안정적 익명 시드(anon_seed = student_id 의 md5 앞 8자)만 준다. is_me 로 본인 강조.
create or replace function public.get_league_standings(
  p_class_id   uuid,
  p_week_start date
) returns table (
  rank      int,
  points    int,
  anon_seed text,
  is_me     boolean
) language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.is_enrolled(p_class_id) and not public.owns_class(p_class_id) then
    raise exception 'permission denied: not a member of class';
  end if;

  return query
    select
      rank() over (order by lp.points desc)::int as rank,
      lp.points,
      substr(md5(lp.student_id::text), 1, 8) as anon_seed,
      (lp.student_id = auth.uid()) as is_me
    from public.league_points lp
    where lp.class_id = p_class_id and lp.week_start = p_week_start
    order by lp.points desc;
end;
$$;

-- ============================================================
-- 3. mistake_feed — 직역 명문장 피드 (opt-in)
--    기본 비공개. is_public=true(명시 동의) 인 항목만 RPC 로 익명 노출.
-- ============================================================
create table if not exists public.mistake_feed (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  original_ko  text not null,
  literal_zh   text not null,
  corrected_zh text not null default '',
  is_public    boolean not null default false,
  likes        int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_mistake_feed_public_created
  on public.mistake_feed (is_public, created_at desc);

alter table public.mistake_feed enable row level security;

-- 본인 항목은 본인이 모두 관리(생성/조회/수정/삭제).
create policy "mistake_feed_owner_all"
  on public.mistake_feed for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- 공개(opt-in) 피드는 RPC(get_public_mistake_feed)로 익명 노출(직접 타인 select 정책 없음).
create or replace function public.get_public_mistake_feed(
  p_limit int default 30
) returns table (
  id           uuid,
  original_ko  text,
  literal_zh   text,
  corrected_zh text,
  likes        int,
  anon_seed    text,
  is_me        boolean,
  created_at   timestamptz
) language plpgsql
  security definer
  set search_path = public
as $$
begin
  return query
    select
      mf.id, mf.original_ko, mf.literal_zh, mf.corrected_zh, mf.likes,
      substr(md5(mf.student_id::text), 1, 8) as anon_seed,
      (mf.student_id = auth.uid()) as is_me,
      mf.created_at
    from public.mistake_feed mf
    where mf.is_public = true
    order by mf.created_at desc
    limit greatest(coalesce(p_limit, 30), 1);
end;
$$;

grant execute on function public.contribute_class_goal(uuid, text)        to authenticated;
grant execute on function public.add_league_points(uuid, uuid, date, int) to authenticated;
grant execute on function public.get_league_standings(uuid, date)         to authenticated;
grant execute on function public.get_public_mistake_feed(int)             to authenticated;
