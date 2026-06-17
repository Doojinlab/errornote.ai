-- Wunote.ai (#54) — push_subscriptions 하드닝.
--
-- 문제:
--   기존 RLS 정책 'push_subscriptions_self_all' 은 본인 행 전체를 대상으로 했고,
--   여기에는 Web Push 키(subscription.keys.p256dh / auth)가 포함된다. 이 키는
--   발송(service_role)에만 필요하며 클라이언트가 다시 읽을 이유가 없다. 클라이언트가
--   SELECT 로 키를 회수할 수 있으면, 세션 탈취 시 키를 빼내 앱 밖에서 임의의 푸시를
--   보내거나(unauthorized push delivery) 엔드포인트를 수집할 수 있다.
--
-- 조치:
--   1) 광범위 self 정책 제거 + 테이블 직접 권한 회수 → 클라이언트(anon/authenticated)는
--      이 테이블에 직접 SELECT/INSERT/UPDATE/DELETE 불가.
--   2) 등록/해제는 SECURITY DEFINER RPC 로만 수행(내부에서 auth.uid() 강제 → 본인 행만).
--      키는 RPC 인자로 들어가기만 하고 어떤 경로로도 클라이언트로 반환되지 않는다.
--   3) 발송 경로(service_role 가 직접 read)는 RLS 를 우회하므로 그대로 동작한다.

-- ============================================================
-- 1. 기존 광범위 정책 제거 (RLS 는 유지 — 정책 없음 = 직접 접근 전면 차단)
-- ============================================================
drop policy if exists "push_subscriptions_self_all" on public.push_subscriptions;

-- ============================================================
-- 2. 테이블 직접 권한 회수 — 클라이언트는 RPC 로만 접근. service_role 은 영향 없음.
-- ============================================================
revoke all on table public.push_subscriptions from anon, authenticated;

-- ============================================================
-- 3. RPC: 본인 구독 등록(업서트). 로그인 사용자가 직접 호출.
-- ============================================================
create or replace function public.register_push_subscription(
  p_endpoint     text,
  p_subscription jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'register_push_subscription: 인증 필요';
  end if;
  if p_endpoint is null or length(p_endpoint) = 0 then
    raise exception 'register_push_subscription: p_endpoint required';
  end if;
  if p_subscription is null then
    raise exception 'register_push_subscription: p_subscription required';
  end if;

  insert into public.push_subscriptions (student_id, endpoint, subscription)
  values (v_uid, p_endpoint, p_subscription)
  on conflict (student_id, endpoint) do update
    set subscription = excluded.subscription;
end;
$$;

-- ============================================================
-- 4. RPC: 본인 구독 해제
-- ============================================================
create or replace function public.unregister_push_subscription(
  p_endpoint text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unregister_push_subscription: 인증 필요';
  end if;
  delete from public.push_subscriptions
   where student_id = v_uid and endpoint = p_endpoint;
end;
$$;

-- ============================================================
-- 5. 권한 — 로그인 사용자(authenticated)만 실행. 내부 auth.uid() 로 본인 행만 조작.
-- ============================================================
revoke all on function public.register_push_subscription(text, jsonb)   from public, anon;
revoke all on function public.unregister_push_subscription(text)        from public, anon;
grant execute on function public.register_push_subscription(text, jsonb) to authenticated;
grant execute on function public.unregister_push_subscription(text)      to authenticated;
