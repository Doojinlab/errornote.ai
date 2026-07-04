-- 개인 자기주도 학습반(personal self-study class) 자동 배정.
--
-- 배경: 학습 루프(sessions / error_cards / /api/analyze)가 sessions.class_id NOT NULL +
--       is_enrolled(class_id) RLS 로 반(class)에 강하게 결합돼 있어, 반이 없는 학생은
--       로그인 후 "수업 등록하기" 빈 화면에서 막혀 서비스를 쓸 수 없다.
--       그러나 이 서비스는 학습자 중심 — 초대코드 없이도 혼자 학습이 메인이어야 한다.
--
-- 해결: 모든 학생에게 '본인 소유' 개인 학습반을 1개 자동 생성 + 자가 등록한다.
--       professor_id = 학생 본인 id 이므로 classes_professor_all / classes_student_select_enrolled
--       두 RLS 로 SELECT 가능하고, sessions INSERT 의 is_enrolled(class_id) 체크도 통과한다.
--       교수자 초대코드로의 참여는 그 위에 추가 enrollment 로 얹힌다(가장 최근 등록이 활성 반).
--
-- 특징: 기존 classes / enrollments 테이블·RLS·API·lib 를 그대로 재사용한다.
--       스키마 변경 없음(추가 전용). 개인 학습반 식별 규칙: invite_code = 'SELF-<student_id>'.

-- ── 개인 학습반 보장(멱등) ─────────────────────────────────────────────────────
create or replace function public.ensure_personal_class(p_student uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_code     text := 'SELF-' || p_student::text;
begin
  -- 이미 있으면 재사용.
  select id into v_class_id
  from public.classes
  where professor_id = p_student and invite_code = v_code
  limit 1;

  if v_class_id is null then
    insert into public.classes (professor_id, name, semester, invite_code, is_active)
    values (p_student, '개인 학습', '자기주도', v_code, true)
    returning id into v_class_id;
  end if;

  -- 자가 등록(멱등).
  insert into public.enrollments (class_id, student_id)
  values (v_class_id, p_student)
  on conflict (class_id, student_id) do nothing;

  return v_class_id;
end;
$$;

-- ── 신규 학생 프로필 생성 시 자동 배정 ─────────────────────────────────────────
-- profiles 는 handle_new_user()(auth.users insert 트리거)로 생성된다. 그 뒤에 걸어
-- 신규 가입 학생이 첫 화면부터 활성 반을 갖도록 한다. 교수자(role='professor')는 제외.
create or replace function public.on_profile_created_personal_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' then
    perform public.ensure_personal_class(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_personal_class on public.profiles;
create trigger trg_profile_personal_class
  after insert on public.profiles
  for each row execute function public.on_profile_created_personal_class();

-- ── 기존 학생 백필 ─────────────────────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in select id from public.profiles where role = 'student' loop
    perform public.ensure_personal_class(r.id);
  end loop;
end $$;
