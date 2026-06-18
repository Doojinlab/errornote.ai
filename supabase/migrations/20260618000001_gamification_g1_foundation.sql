-- errornote — gamification G1 기반 (동반자 + 화폐 + 오류 도감)
-- 설계 근거: docs/gamification-spec.md §1, §4, §5(Phase G1)
--
-- 포함:
--   1) gamification_stats 이중 화폐 컬럼 (activity_coins / mastery_points)
--   2) error_species        : 오류 유형 도감 마스터(把字句·양사·어순 등) + 기본 시드
--   3) user_dex_entries      : 학습자별 도감 수집/졸업 상태
--   4) award_currency RPC    : 화폐 적립/소비 (mastery 는 서버 전용)
--   5) record_dex_encounter  : 误 몬스터 조우 기록 (오류 발생 시)
--
-- 설계 메모(스펙 §4 대비 변경): 스펙은 이중 화폐를 profiles 에 두자고 했으나
-- gamification_stats 에 둔다. (a) XP/streak 이 이미 여기 있고 add_xp/touch_streak
-- SECURITY DEFINER 패턴을 재사용하며, (b) profiles 의 self_update 정책으로는 화폐
-- 변조를 막기 어렵다. M4 "갈 수 없는 화폐(mastery_points)"의 무결성을 위해 mastery 는
-- SECURITY DEFINER RPC 를 통해 서버(service-role)에서만 적립되도록 강제한다.

-- ============================================================
-- 1. gamification_stats — 이중 화폐 컬럼
--    activity_coins : 쓰면 쌓이는 활동 화폐(가챠/코스메틱용, 소비 가능)
--    mastery_points : 오류 유형을 실제 졸업시켜야만 오르는 숙련 화폐(소비 불가)
-- ============================================================
alter table public.gamification_stats
  add column if not exists activity_coins int not null default 0,
  add column if not exists mastery_points int not null default 0;

-- 1b. mastery_points 변조 방지 트리거
-- 기존 gamification_stats_student_self_all(RLS)은 학생의 직접 UPDATE 를 허용한다
-- (lib/gamification.ts 가 xp/level/streak 을 직접 update 하기 때문에 유지 필요).
-- 그 틈으로 mastery_points 를 직접 조작하는 것을 막는다: mastery_points 가 바뀌는
-- UPDATE 는 service_role 만 허용(=서버/award_currency 서버호출 경유). activity_coins·
-- xp 등 다른 컬럼의 본인 self-update 는 영향 없음.
create or replace function public.guard_mastery_points()
returns trigger
language plpgsql
as $$
begin
  if new.mastery_points is distinct from old.mastery_points
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'mastery_points may only be changed server-side';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_mastery_points on public.gamification_stats;
create trigger trg_guard_mastery_points
  before update on public.gamification_stats
  for each row execute function public.guard_mastery_points();

-- ============================================================
-- 2. error_species — 오류 유형 도감 마스터(전역 reference data)
--    code: 앱 코드가 참조하는 안정적 슬러그(ASCII). name_zh/name_ko 는 표시용.
-- ============================================================
create table if not exists public.error_species (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  category     text not null check (category in ('vocab', 'grammar')),
  name_zh      text not null,
  name_ko      text not null,
  hsk_level    int  check (hsk_level between 1 and 6),
  description  text not null default '',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_error_species_category_sort
  on public.error_species (category, sort_order);

-- 기본 도감 시드(idempotent). 误 몬스터 12종 — 한국 중국어 학습자 전형 오류.
insert into public.error_species (code, category, name_zh, name_ko, hsk_level, description, sort_order)
values
  ('ba_construction', 'grammar', '把字句',   '把자문',        4, '처치(處置)를 나타내는 把자문. 목적어 위치와 술어 형태가 까다롭다.', 10),
  ('word_order',      'grammar', '语序',     '어순',          2, '부사어·보어·시량보어 등의 어순 규칙 위반.',                       20),
  ('measure_word',    'grammar', '量词',     '양사',          1, '명사와 짝이 맞지 않는 양사 사용.',                               30),
  ('separable_verb',  'grammar', '离合词',   '이합사',        4, '离合词를 분리해야 하는데 붙여 쓰거나 그 반대.',                  40),
  ('le_usage',        'grammar', '“了”的使用', '了 용법',      2, '동태조사 了 와 어기조사 了 의 혼동·누락·오용.',                  50),
  ('shi_de',          'grammar', '“是…的”结构', '是…的 구문',  3, '이미 일어난 동작의 시간·장소·방식 강조 구문 오류.',              60),
  ('complement',      'grammar', '补语',     '보어',          3, '정도·결과·방향·가능 보어의 누락 또는 잘못된 결합.',             70),
  ('function_word',   'grammar', '虚词',     '허사',          3, '개사·접속사·조사 등 허사의 누락·잉여·오용.',                    80),
  ('wrong_word',      'vocab',   '错词',     '错词(오어)',    2, '의미는 비슷하나 문맥에 맞지 않는 단어 선택.',                    110),
  ('missing_word',    'vocab',   '缺词',     '缺词(결어)',    1, '문장 성립에 필요한 성분 누락.',                                 120),
  ('redundant_word',  'vocab',   '多词',     '多词(잉여)',    2, '불필요하게 중복되거나 잉여인 성분.',                            130),
  ('collocation',     'vocab',   '搭配',     '연어(搭配)',    3, '습관적으로 함께 쓰지 않는 단어들의 결합.',                      140)
on conflict (code) do nothing;

-- ============================================================
-- 3. user_dex_entries — 학습자별 도감 상태
--    status: encountered(조우) → tamed(길들임/일정기간 무사고) → graduated(졸업)
--    쓰기는 RPC(record_dex_encounter / 졸업 플로우) 경유. 직접 update 불허(변조 방지).
-- ============================================================
create table if not exists public.user_dex_entries (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references public.profiles(id) on delete cascade,
  species_id            uuid not null references public.error_species(id) on delete cascade,
  status                text not null default 'encountered'
                          check (status in ('encountered', 'tamed', 'graduated')),
  encounter_count       int  not null default 0,
  first_encountered_at  timestamptz not null default now(),
  tamed_at              timestamptz,
  graduated_at          timestamptz,
  updated_at            timestamptz not null default now(),
  unique (student_id, species_id)
);

create index if not exists idx_user_dex_entries_student_status
  on public.user_dex_entries (student_id, status);

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.error_species    enable row level security;
alter table public.user_dex_entries enable row level security;

-- error_species 는 전역 reference data. 로그인 사용자 누구나 읽기.
-- 쓰기 정책 없음(=차단). 마스터 변경은 마이그레이션/service-role 만.
create policy "error_species_authenticated_select"
  on public.error_species for select
  using (auth.uid() is not null);

-- user_dex_entries: 학생 본인 select / 교수자는 enrolled 학생 select.
-- 쓰기는 SECURITY DEFINER RPC 경유(아래). 직접 insert/update/delete 정책 없음(=차단).
create policy "user_dex_entries_student_self_select"
  on public.user_dex_entries for select
  using (student_id = auth.uid());

create policy "user_dex_entries_professor_select"
  on public.user_dex_entries for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = user_dex_entries.student_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- 5. award_currency — 화폐 적립/소비 (atomic)
--    activity_coins : 본인 호출 허용(가챠/활동 보상). 음수=소비, floor at 0.
--    mastery_points : auth.uid() 가 있으면(=클라이언트 직접 호출) 거부.
--                     졸업 플로우 등 서버(service-role)에서만 적립 → M4 무결성.
-- ============================================================
create or replace function public.award_currency(
  p_student_id     uuid,
  p_activity_delta int default 0,
  p_mastery_delta  int default 0
) returns table (
  activity_coins int,
  mastery_points int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity int;
  v_mastery  int;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot modify currency for another user';
  end if;
  if p_mastery_delta <> 0 and auth.uid() is not null then
    raise exception 'mastery points may only be awarded server-side';
  end if;

  insert into public.gamification_stats (student_id, activity_coins, mastery_points)
  values (p_student_id, greatest(coalesce(p_activity_delta, 0), 0), greatest(coalesce(p_mastery_delta, 0), 0))
  on conflict (student_id) do update
    set activity_coins = greatest(gamification_stats.activity_coins + coalesce(p_activity_delta, 0), 0),
        mastery_points = greatest(gamification_stats.mastery_points + coalesce(p_mastery_delta, 0), 0),
        updated_at = now()
  returning gamification_stats.activity_coins, gamification_stats.mastery_points
    into v_activity, v_mastery;

  return query select v_activity, v_mastery;
end;
$$;

-- ============================================================
-- 6. record_dex_encounter — 误 몬스터 조우 기록 (오류 발생 시)
--    code 로 species 를 찾아 도감 항목을 upsert. encounter_count 증가.
--    졸업(graduated) 항목은 재조우해도 status 를 되돌리지 않는다.
-- ============================================================
create or replace function public.record_dex_encounter(
  p_student_id uuid,
  p_code       text
) returns table (
  status          text,
  encounter_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_species_id uuid;
  v_status     text;
  v_count      int;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot modify dex for another user';
  end if;

  select id into v_species_id from public.error_species where code = p_code;
  if v_species_id is null then
    raise exception 'unknown error_species code: %', p_code;
  end if;

  insert into public.user_dex_entries (student_id, species_id, status, encounter_count, first_encountered_at)
  values (p_student_id, v_species_id, 'encountered', 1, now())
  on conflict (student_id, species_id) do update
    set encounter_count = user_dex_entries.encounter_count + 1,
        -- graduated 는 유지, 그 외에는 encountered 로(재발 = 다시 잡아야 함)
        status = case when user_dex_entries.status = 'graduated' then 'graduated' else 'encountered' end,
        updated_at = now()
  returning user_dex_entries.status, user_dex_entries.encounter_count
    into v_status, v_count;

  return query select v_status, v_count;
end;
$$;

grant execute on function public.award_currency(uuid, int, int)      to authenticated;
grant execute on function public.record_dex_encounter(uuid, text)    to authenticated;
