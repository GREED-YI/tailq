-- 오늘의 질문 세션과 복습 일정(08 설계 3장 "학습"). 질문 고르기 규칙은 서버(lib/daily-pick.ts)가 정하고,
-- start_daily_session이 "하루 1세션"과 전날 세션 정리를 한 트랜잭션으로 지킨다.
-- 체험 열(trial_token, ip_hash)은 체험 이슈에서, 북마크·프로젝트는 각 이슈에서 더한다.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id int not null references public.questions (id) on delete cascade,
  kind text not null check (kind in ('daily', 'project', 'trial')),
  -- 오늘의 질문을 어떻게 골랐는지. "복습" 표시와 "새 질문을 다 풀었어요" 안내를 다시 그리는 데 쓴다
  pick text check (pick in ('review', 'new', 'advance')),
  -- 한국 시간 날짜
  day date not null,
  status text not null default 'open' check (status in ('open', 'done', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((kind = 'daily') = (pick is not null))
);

-- 하루 1세션. 같은 날 다시 열어도 같은 질문이 나온다
create unique index sessions_daily_day on public.sessions (user_id, day) where kind = 'daily';

-- 세션의 본 질문(idx 0)과 꼬리질문(idx 1~3). 채점 열은 답변·채점 이슈에서 채운다
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  idx smallint not null check (idx between 0 and 3),
  -- 꼬리질문 글. 본 질문 글은 questions에 있다
  follow_up_prompt text,
  answer text,
  status text not null default 'answering'
    check (status in ('answering', 'grading', 'graded', 'failed', 'skipped')),
  grading_started_at timestamptz,
  grading_attempts smallint not null default 0,
  answered_at timestamptz,
  score smallint check (score between 0 and 100),
  verdict text check (verdict in ('good', 'partial', 'wrong', 'unknown')),
  feedback jsonb,
  rating smallint check (rating in (1, -1)),
  unique (session_id, idx),
  check ((idx = 0) = (follow_up_prompt is null)),
  -- 본 질문만 점수가 있고, 판정은 "모르겠어요"일 때만 unknown
  check (idx = 0 or score is null),
  check (idx > 0 or verdict is null or verdict = 'unknown'),
  check (idx > 0 or status <> 'graded' or score is not null)
);

-- 복습 상자(04 기능 명세 5번). box가 null이면 익힌 질문이라 복습에서 빠진다
create table public.reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id int not null references public.questions (id) on delete cascade,
  box smallint check (box between 1 and 5),
  due_day date not null,
  primary key (user_id, question_id)
);

-- 읽기 정책만 두고 쓰기는 서버의 DB 함수로만 한다(08 설계 "데이터 읽고 쓰는 길")
alter table public.sessions enable row level security;
alter table public.turns enable row level security;
alter table public.reviews enable row level security;

create policy "sessions: 자기 행만 읽기"
  on public.sessions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "turns: 자기 세션의 턴만 읽기"
  on public.turns for select
  to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = turns.session_id and s.user_id = (select auth.uid())
  ));

create policy "reviews: 자기 행만 읽기"
  on public.reviews for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 질문은 내 세션·복습에 나온 것만 읽는다(08 설계 "questions 읽기 정책").
-- 북마크·프로젝트 조건은 그 테이블이 생길 때 이 정책을 바꿔 더한다.
create policy "questions: 내 세션·복습의 질문만 읽기"
  on public.questions for select
  to authenticated
  using (
    exists (select 1 from public.sessions s where s.question_id = questions.id and s.user_id = (select auth.uid()))
    or exists (select 1 from public.reviews r where r.question_id = questions.id and r.user_id = (select auth.uid()))
  );

-- 오늘의 질문 세션을 연다. 서버가 고른 질문(p_question_id, p_pick)을 받는다.
-- 1. 사용자 잠금(같은 사용자의 동시 요청을 한 줄로 세운다)
-- 2. 지난 날 열린 세션 정리: 본 질문을 제출했으면 done + 남은 꼬리질문 skipped, 아니면 expired
--    (놓친 날의 새 질문은 사라진다. 복습 질문이면 reviews는 그대로라 다음에 다시 나온다)
-- 3. 오늘 세션이 이미 있으면 그것을 돌려준다(하루 동안 같은 질문). 없으면 세션 + 본 질문 턴을 만든다
create function public.start_daily_session(p_user_id uuid, p_question_id int, p_pick text)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  result public.sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily:' || p_user_id::text, 0));

  update public.turns t
  set status = 'skipped'
  from public.sessions s
  where s.id = t.session_id
    and s.user_id = p_user_id and s.kind = 'daily' and s.status = 'open' and s.day < today
    and t.status = 'answering'
    and exists (
      select 1 from public.turns t0
      where t0.session_id = s.id and t0.idx = 0 and t0.answered_at is not null
    );

  update public.sessions s
  set status = case when a.answered then 'done' else 'expired' end,
      completed_at = case when a.answered then now() end
  from (
    select s2.id, exists (
      select 1 from public.turns t0
      where t0.session_id = s2.id and t0.idx = 0 and t0.answered_at is not null
    ) as answered
    from public.sessions s2
    where s2.user_id = p_user_id and s2.kind = 'daily' and s2.status = 'open' and s2.day < today
  ) a
  where s.id = a.id;

  select * into result
  from public.sessions
  where user_id = p_user_id and kind = 'daily' and day = today;
  if found then
    return result;
  end if;

  insert into public.sessions (user_id, question_id, kind, pick, day)
  values (p_user_id, p_question_id, 'daily', p_pick, today)
  returning * into result;

  insert into public.turns (session_id, idx) values (result.id, 0);

  return result;
end;
$$;

revoke execute on function public.start_daily_session(uuid, int, text) from public, anon, authenticated;
grant execute on function public.start_daily_session(uuid, int, text) to service_role;
