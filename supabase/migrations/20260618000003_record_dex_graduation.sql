-- errornote — gamification G2: 도감 졸업 RPC (닫힘 루프 완성)
-- 설계 근거: docs/gamification-spec.md M6(오답 졸업식), §1.2.
--
-- 화석화됐던 오류 유형을 학습자가 극복하면 도감 항목을 'graduated' 로 전환한다.
-- newly_graduated 를 반환해 호출처(lib/graduation.ts)가 "이번에 처음 졸업한 경우에만"
-- mastery_points 를 적립하도록 한다(중복 보상 방지). mastery 적립 자체는 award_currency
-- (service-role) + guard_mastery_points 트리거로 보호되므로, 이 RPC 의 self 호출만으로는
-- 숙련 화폐가 오르지 않는다(도감 상태만 바뀜).

create or replace function public.record_dex_graduation(
  p_student_id uuid,
  p_code       text
) returns table (
  newly_graduated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_species_id uuid;
  v_prev       text;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot modify dex for another user';
  end if;

  select id into v_species_id from public.error_species where code = p_code;
  if v_species_id is null then
    raise exception 'unknown error_species code: %', p_code;
  end if;

  select status into v_prev
    from public.user_dex_entries
    where student_id = p_student_id and species_id = v_species_id;

  insert into public.user_dex_entries (
    student_id, species_id, status, encounter_count, first_encountered_at, graduated_at
  )
  values (p_student_id, v_species_id, 'graduated', 0, now(), now())
  on conflict (student_id, species_id) do update
    set status       = 'graduated',
        graduated_at = coalesce(user_dex_entries.graduated_at, now()),
        updated_at   = now();

  return query select coalesce(v_prev, '') <> 'graduated';
end;
$$;

grant execute on function public.record_dex_graduation(uuid, text) to authenticated;
