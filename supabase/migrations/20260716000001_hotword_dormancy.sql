-- 今日热词 동면 타임스탬프 (docs/dashboard-features.md §2.5, §3 동면 재등판 정책)
--
-- 동면(status='dormant') 전환 시각을 기록해, 냉각 기간이 지난 카드를 자동 재등판시킨다.
-- 재등판 = 삭제 아님(영구 삭제 없음) — 냉각 후 새 시도 기회를 준다.
-- append-only: 기존 20260715000002_dashboard_features.sql 은 수정하지 않는다.

alter table public.hotwords
  add column if not exists dormant_at timestamptz;

-- 재등판 후보 조회(동면 + 냉각 경과)용 부분 인덱스.
create index if not exists idx_hotwords_dormant_at
  on public.hotwords (dormant_at)
  where status = 'dormant';
