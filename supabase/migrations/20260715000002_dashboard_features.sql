-- 대시보드 확장 기능 — 실전 HSK · 今日热词 (docs/dashboard-features.md)
--
-- 좌: 실전 HSK(기출 유형 AI 생성 문제) · 우: 今日热词(트렌드 신조어 카드).
-- 두 기능 모두 "입장하기" 시 기존 3분할 워크스페이스를 재사용하고, 교정→오류카드→내 오류
-- 파이프라인(error_cards)을 그대로 쓴다. 여기서는 그 위에 올리는 신규 테이블만 정의한다.
--
-- ⚠️ 기존 weekly_cardnews(주간 개인 리포트)와 완전히 별개다. 이 마이그레이션은
--    weekly_cardnews 관련 테이블·정책을 일절 건드리지 않는다.
--
-- 접근 원칙:
--  · hotwords 풀은 파이프라인(service_role)이 채우고, 학생은 active 카드만 읽는다.
--  · 좋았어요/비추는 1인 1표(unique) — 봇/연타는 unique + 서버 집계로 무시.
--  · 노출(impression)도 학생×카드 1회만 집계해 like_rate 분모를 정직하게 만든다.
--  · 교체 = 삭제 아닌 동면(status='dormant'). 영구 삭제 없음.

-- ============================================================
-- 今日热词 풀
-- ============================================================
create table if not exists public.hotwords (
  id             uuid primary key default gen_random_uuid(),
  term           text not null,                              -- 표현 (예: city不city)
  category       text not null
                   check (category in ('game','entertainment','society','economy','daily','meme')),
  pinyin         text,                                       -- 병음
  literal        text,                                       -- 직역
  meaning        text,                                       -- 실제 의미·뉘앙스
  example        text,                                       -- 예문(중국어)
  origin         text,                                       -- 유래
  register_tag   text,                                       -- 격식도 태그(예: 인터넷 유행어/구어/중립)
  sources        jsonb not null default '[]'::jsonb,         -- [{name,url,date}] 실재검증 근거(2곳↑)
  first_seen     date not null default current_date,         -- 최근 2~3개월 등장 기준
  status         text not null default 'active'
                   check (status in ('active', 'dormant')),  -- 동면(cooldown) 후 재등판 가능
  exposure_until date,                                       -- 노출 만료(신선도 정렬용, null=무기한)
  impressions    int  not null default 0,                    -- 고유 노출 수(집계 캐시)
  likes          int  not null default 0,                    -- 좋았어요 수(집계 캐시)
  dislikes       int  not null default 0,                    -- 비추 수(집계 캐시)
  created_at     timestamptz not null default now()
);

alter table public.hotwords enable row level security;

-- 학생은 active 카드만 열람. 쓰기(파이프라인·집계)는 service_role 이 RLS 우회.
drop policy if exists "hotwords_active_select" on public.hotwords;
create policy "hotwords_active_select"
  on public.hotwords for select
  using (status = 'active');

-- 분야별 신선도 정렬(관심분야 개인화 배포)용 인덱스.
create index if not exists idx_hotwords_category_status_fresh
  on public.hotwords (category, status, first_seen desc);

-- ============================================================
-- 今日热词 피드백 — 좋았어요/비추 (1인 1표)
-- ============================================================
create table if not exists public.hotword_feedback (
  id          uuid primary key default gen_random_uuid(),
  hotword_id  uuid not null references public.hotwords(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  vote        text not null check (vote in ('like', 'dislike')),
  created_at  timestamptz not null default now(),
  unique (hotword_id, student_id)                            -- 1인 1표: 계정×카드당 1회
);

alter table public.hotword_feedback enable row level security;

drop policy if exists "hotword_feedback_student_self_all" on public.hotword_feedback;
create policy "hotword_feedback_student_self_all"
  on public.hotword_feedback for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create index if not exists idx_hotword_feedback_hotword
  on public.hotword_feedback (hotword_id);

-- ============================================================
-- 今日热词 노출 로그 — 고유 노출(정직한 like_rate 분모)
-- ============================================================
create table if not exists public.hotword_impressions (
  id          uuid primary key default gen_random_uuid(),
  hotword_id  uuid not null references public.hotwords(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (hotword_id, student_id)                            -- 학생×카드 1회만 집계
);

alter table public.hotword_impressions enable row level security;

drop policy if exists "hotword_impressions_student_self_all" on public.hotword_impressions;
create policy "hotword_impressions_student_self_all"
  on public.hotword_impressions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ============================================================
-- 실전 HSK — AI 생성 문제 로그
-- ============================================================
-- ⚠️ 저작권: 실제 HSK 기출 원문 저장 금지. "기출 유형 학습 AI 생성 문제"만 스냅샷한다.
create table if not exists public.hsk_generated_questions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  level          int  not null check (level between 3 and 6),      -- HSK 3/4/5/6
  area           text not null check (area in ('reading','writing','speaking')),
  mode           text not null check (mode in ('practice','concept')), -- 문제 풀이/개념 학습
  question       jsonb not null default '{}'::jsonb,               -- 생성 문제 스냅샷
  created_at     timestamptz not null default now()
);

alter table public.hsk_generated_questions enable row level security;

drop policy if exists "hsk_generated_questions_student_self_all" on public.hsk_generated_questions;
create policy "hsk_generated_questions_student_self_all"
  on public.hsk_generated_questions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create index if not exists idx_hsk_questions_student_created
  on public.hsk_generated_questions (student_id, created_at desc);

-- ============================================================
-- 시드 — 라이브 web search 연동 전까지 대시보드가 실제 카드를 렌더하도록 6분야 1개씩.
-- (docs/dashboard-features.md §3: web search 연동은 미해결 → 시드로 구동)
-- 고정 UUID + on conflict do nothing 으로 재실행 안전.
-- ============================================================
insert into public.hotwords (id, term, category, pinyin, literal, meaning, example, origin, register_tag, first_seen, exposure_until)
values
  ('a1b2c3d4-0001-4000-8000-000000000001', 'city不city', 'meme',
   'city bù city', '도시 아니 도시',
   '"도시적이다/세련됐다"를 묻는 말. 외국인 인플루언서가 "上海, city不city啊?"라고 물으며 유행. 감탄·놀림 뉘앙스.',
   '哇，这个地方太city了！', '외국인 여행 인플루언서 영상에서 파생된 2024년 밈.',
   '인터넷 유행어', current_date - 40, current_date + 21),
  ('a1b2c3d4-0002-4000-8000-000000000002', '尊嘟假嘟', 'daily',
   'zūn du jiǎ du', '진짜야 가짜야',
   '"真的假的(정말이야?)"를 애교 섞인 발음으로 귀엽게 표현한 말. 놀람·반문.',
   '啊？尊嘟假嘟？我不信！', '어린아이·펫 말투를 흉내 낸 애교체에서 확산.',
   '구어·애교체', current_date - 55, current_date + 21),
  ('a1b2c3d4-0003-4000-8000-000000000003', '搭子', 'society',
   'dāzi', '짝꿍',
   '특정 활동만 함께하는 가벼운 동반자. 밥搭子(밥친구), 学习搭子(공부메이트)처럼 앞에 활동을 붙여 쓴다.',
   '我找了个健身搭子，一起去健身房。', '깊은 관계 부담 없이 활동만 공유하는 청년 문화에서 확산.',
   '구어', current_date - 70, current_date + 21),
  ('a1b2c3d4-0004-4000-8000-000000000004', '公司破产了', 'economy',
   'gōngsī pòchǎn le', '회사가 파산했다',
   '실제 파산이 아니라, 어이없거나 큰일 났을 때 과장해서 쓰는 밈. "나 망했어" 같은 자조 유머.',
   '听到这消息，我感觉我的公司破产了。', '자영업·직장인 밈에서 과장 표현으로 확산.',
   '인터넷 유행어', current_date - 35, current_date + 21),
  ('a1b2c3d4-0005-4000-8000-000000000005', '哈基米', 'entertainment',
   'hā jī mǐ', '(음차)',
   '일본어 노래 가사에서 온 의성어 밈. 주로 고양이 등 귀여운 존재를 부르거나 흥얼거릴 때 쓰는 유행어.',
   '哈基米~ 这只猫也太可爱了吧！', '숏폼 배경음에서 확산된 음차 밈.',
   '인터넷 유행어', current_date - 50, current_date + 21),
  ('a1b2c3d4-0006-4000-8000-000000000006', '开黑', 'game',
   'kāi hēi', '검은 방을 열다',
   '음성 채팅을 켜고 친구들과 팀을 짜서 온라인 게임을 함께 하는 것. 게이머 필수 표현.',
   '晚上一起开黑打游戏吗？', '게임 보이스팀플레이에서 굳어진 게이머 은어.',
   '게이머 은어', current_date - 90, current_date + 21)
on conflict (id) do nothing;
