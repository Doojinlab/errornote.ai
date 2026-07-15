-- 튜터 연습 퀴즈(generate_quiz) 오답 자동 저장.
--
-- 배경: AI 과외 채팅의 "연습 퀴즈"는 클라이언트 전용이라 학습자가 틀려도 아무것도
--       기록되지 않았다. 학습자가 틀린 문제를 날짜별로 모아 언제든 열람할 수 있도록
--       문항 스냅샷(문항·보기·선택/정답 인덱스·해설)을 영속화한다.
-- 왜 새 테이블인가: 기존 quiz_results 는 error_card_id NOT NULL 로 작문-오류 기반
--       퀴즈에만 맞고 문항 스냅샷을 담지 않는다. 튜터 퀴즈는 error_card 가 없으므로
--       문항 자체를 스냅샷하는 별도 테이블을 둔다.
-- 접근: 학생 본인만(RLS). 오답만 기록(선택≠정답).

create table if not exists public.quiz_mistakes (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  topic          text,
  prompt         text not null,
  options        jsonb not null default '[]'::jsonb,
  chosen_index   int not null,
  answer_index   int not null,
  explanation    text,
  chapter_number int,
  created_at     timestamptz not null default now()
);

alter table public.quiz_mistakes enable row level security;

drop policy if exists "quiz_mistakes_student_self_all" on public.quiz_mistakes;
create policy "quiz_mistakes_student_self_all"
  on public.quiz_mistakes for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- 날짜별 라이브러리 조회(본인 + 최신순)를 위한 복합 인덱스.
create index if not exists idx_quiz_mistakes_student_created
  on public.quiz_mistakes (student_id, created_at desc);
