-- errornote — gamification G3 가챠 (코스메틱 보상 상자)
-- 설계 근거: docs/gamification-spec.md §2 M3(데일리 퀘스트+가챠), M4(이중 화폐), §5 Phase G3
-- 패턴: 20260618000001_gamification_g1_foundation.sql 을 따른다.
--
-- 과잉 게임화 경계(spec §0, §6): 가챠 보상은 **코스메틱만**(사운드팩·테마·아바타·스티커).
--   - 학습 능력에 영향 없음 → 과금/페이월 압박 회피.
--   - 활동 화폐(activity_coins)로만 뽑는다. 숙련 화폐(mastery_points)는 가챠와 무관.

-- ============================================================
-- 1. reward_items — 가챠 코스메틱 카탈로그(전역 reference data)
--    code: 앱이 참조하는 안정적 슬러그. rarity 가중치로 뽑힌다.
-- ============================================================
create table if not exists public.reward_items (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  category    text not null check (category in ('sound_pack', 'theme', 'avatar', 'sticker')),
  name_ko     text not null,
  name_zh     text not null default '',
  rarity      text not null default 'common' check (rarity in ('common', 'rare', 'epic')),
  icon        text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reward_items_category_sort
  on public.reward_items (category, sort_order);

-- 기본 코스메틱 시드(idempotent). 误 동반자 테마와 어울리는 코스메틱 12종.
insert into public.reward_items (code, category, name_ko, name_zh, rarity, icon, sort_order)
values
  ('sound_classic',   'sound_pack', '클래식 효과음',   '经典音效',   'common', '🔔', 10),
  ('sound_retro',     'sound_pack', '레트로 8비트',    '复古8位',    'rare',   '🎮', 11),
  ('sound_guzheng',   'sound_pack', '古筝 사운드팩',   '古筝音效',   'epic',   '🎼', 12),
  ('theme_ink',       'theme',      '수묵 테마',       '水墨主题',   'common', '🖌️', 20),
  ('theme_panda',     'theme',      '판다 테마',       '熊猫主题',   'common', '🐼', 21),
  ('theme_dragon',    'theme',      '용 테마',         '龙主题',     'rare',   '🐉', 22),
  ('theme_lantern',   'theme',      '홍등 테마',       '红灯笼主题', 'epic',   '🏮', 23),
  ('avatar_scholar',  'avatar',     '서생 误',         '书生误',     'common', '📜', 30),
  ('avatar_master',   'avatar',     '사부 误',         '师父误',     'rare',   '🥋', 31),
  ('avatar_immortal', 'avatar',     '신선 误',         '神仙误',     'epic',   '✨', 32),
  ('sticker_good',    'sticker',    '잘했어요 스티커', '真棒贴纸',   'common', '👍', 40),
  ('sticker_fire',    'sticker',    '불타는 스티커',   '加油贴纸',   'rare',   '🔥', 41)
on conflict (code) do nothing;

-- ============================================================
-- 2. reward_inventory — 학습자 보유 코스메틱(소장형: 보유/미보유)
--    쓰기는 RPC(pull_gacha) 경유. 직접 쓰기 정책 없음(=차단, 변조 방지).
-- ============================================================
create table if not exists public.reward_inventory (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  item_id     uuid not null references public.reward_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  unique (student_id, item_id)
);

create index if not exists idx_reward_inventory_student
  on public.reward_inventory (student_id);

-- ============================================================
-- 3. RLS
-- ============================================================
alter table public.reward_items     enable row level security;
alter table public.reward_inventory enable row level security;

-- reward_items 는 전역 카탈로그. 로그인 사용자 누구나 읽기. 쓰기 정책 없음(=차단).
create policy "reward_items_authenticated_select"
  on public.reward_items for select
  using (auth.uid() is not null);

-- reward_inventory: 학생 본인 select / 교수자는 enrolled 학생 select.
-- 쓰기는 SECURITY DEFINER RPC(pull_gacha) 경유. 직접 쓰기 정책 없음(=차단).
create policy "reward_inventory_student_self_select"
  on public.reward_inventory for select
  using (student_id = auth.uid());

create policy "reward_inventory_professor_select"
  on public.reward_inventory for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = reward_inventory.student_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- 4. pull_gacha — 활동 화폐로 코스메틱 1회 뽑기 (atomic)
--    1) activity_coins >= cost 확인 후 차감
--    2) rarity 가중치(common 70 / rare 25 / epic 5)로 한 아이템 선택
--    3) 신규면 인벤토리에 추가, 중복이면 cost 의 50% 환급(무벌점 보상감)
--    반환: 뽑힌 아이템 + 중복 여부 + 차감 후 잔액
-- ============================================================
create or replace function public.pull_gacha(
  p_student_id uuid,
  p_cost       int
) returns table (
  item_code     text,
  item_id       uuid,
  rarity        text,
  is_duplicate  boolean,
  activity_coins int
) language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_coins        int;
  v_item_id      uuid;
  v_item_code    text;
  v_rarity       text;
  v_dup          boolean := false;
  v_refund       int;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot pull gacha for another user';
  end if;
  if p_cost is null or p_cost <= 0 then
    raise exception 'invalid gacha cost: %', p_cost;
  end if;

  -- 잔액 확인(행 잠금으로 동시 뽑기 경합 방지)
  select activity_coins into v_coins
    from public.gamification_stats
    where student_id = p_student_id
    for update;

  if v_coins is null then
    raise exception 'no gamification_stats row for student';
  end if;
  if v_coins < p_cost then
    raise exception 'insufficient activity_coins: have %, need %', v_coins, p_cost;
  end if;

  -- rarity 가중 무작위 1개 선택 (A-Res: key = random()^(1/weight), 최대 key 선택)
  select id, code, rarity
    into v_item_id, v_item_code, v_rarity
    from (
      select id, code, rarity,
             case rarity when 'common' then 70 when 'rare' then 25 when 'epic' then 5 else 1 end as w
        from public.reward_items
    ) wi
    order by power(random(), 1.0 / w) desc
    limit 1;

  if v_item_id is null then
    raise exception 'no reward_items available';
  end if;

  -- 차감
  v_coins := v_coins - p_cost;

  -- 인벤토리 추가(중복이면 no-op → 환급)
  insert into public.reward_inventory (student_id, item_id)
  values (p_student_id, v_item_id)
  on conflict (student_id, item_id) do nothing;

  if not found then
    v_dup := true;
    v_refund := p_cost / 2;       -- 정수 나눗셈(바닥)
    v_coins := v_coins + v_refund;
  end if;

  update public.gamification_stats
    set activity_coins = v_coins,
        updated_at = now()
    where student_id = p_student_id;

  return query select v_item_code, v_item_id, v_rarity, v_dup, v_coins;
end;
$$;

grant execute on function public.pull_gacha(uuid, int) to authenticated;
