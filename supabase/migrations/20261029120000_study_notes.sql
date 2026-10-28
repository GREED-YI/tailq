-- 학습 자료로 면접 질문 만들기(#141, 04 기능 명세 9번 "학습 자료", 08 설계 "학습 자료 질문 생성", 3장 "study_notes").
-- 내 프로젝트(20261027120000_projects, 20261028090000_usage_cap)와 같은 흐름이다. 등록은 바로 응답하고(generating),
-- 질문 5개 생성은 서버가 뒤에서 한 뒤 save_note_questions로 저장한다. 지우면 그 질문과 기록이 cascade로 함께 지워진다.
-- 처음엔 projects에 종류 컬럼을 두는 안을 봤으나 프로젝트와 학습 자료는 다른 것이라 테이블을 나눴다(2026-10-28, #141)
create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  -- 마크다운 원문. 파일은 브라우저에서 글로 읽어 넣고 따로 저장하지 않는다
  content text not null check (char_length(content) between 30 and 10000),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create index study_notes_user on public.study_notes (user_id, created_at);

-- 질문은 은행·프로젝트·학습 자료 중 정확히 하나다. 프로젝트·학습 자료 질문은 세부 주제·난이도가 없어
-- 약점 리포트·연습 범위(bank_questions)에서 저절로 빠진다
alter table public.questions
  add column note_id uuid references public.study_notes (id) on delete cascade,
  drop constraint questions_bank_or_project,
  add constraint questions_source check (
    case
      when project_id is null and note_id is null then topic_id is not null and level is not null
      else num_nonnulls(project_id, note_id) = 1 and topic_id is null and level is null and trial_field is null
    end
  );

create index questions_note on public.questions (note_id) where note_id is not null;

-- 읽기 정책만 두고 쓰기는 서버의 DB 함수로만 한다(08 설계 "데이터 읽고 쓰는 길")
alter table public.study_notes enable row level security;

create policy "study_notes: 자기 행만 읽기"
  on public.study_notes for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 질문 읽기 정책에 학습 자료를 더한다(08 설계 "questions 읽기 정책")
drop policy "questions: 내 세션·복습·북마크·프로젝트의 질문만 읽기" on public.questions;
create policy "questions: 내 세션·복습·북마크·프로젝트·학습 자료의 질문만 읽기"
  on public.questions for select
  to authenticated
  using (
    exists (select 1 from public.sessions s where s.question_id = questions.id and s.user_id = (select auth.uid()))
    or exists (select 1 from public.reviews r where r.question_id = questions.id and r.user_id = (select auth.uid()))
    or exists (select 1 from public.bookmarks b where b.question_id = questions.id and b.user_id = (select auth.uid()))
    or exists (select 1 from public.projects p where p.id = questions.project_id and p.user_id = (select auth.uid()))
    or exists (select 1 from public.study_notes n where n.id = questions.note_id and n.user_id = (select auth.uid()))
  );

-- 학습 자료 질문 생성 호출은 purpose = note_gen으로 남긴다. 하루 한도 몫(quota)은 프로젝트와 같은 project_gen이라 함께 센다
alter table public.ai_usage
  drop constraint ai_usage_purpose_check,
  add constraint ai_usage_purpose_check check (purpose in ('grade', 'follow_up', 'project_gen', 'note_gen', 'trial'));

-- 학습 자료 등록: 3개 제한(프로젝트와 따로) → 월 예산 → 하루 1회(프로젝트와 함께)를 확인하고 생성 몫을 예약한다.
-- 하루 한도를 create_project와 함께 세므로 같은 사용자 잠금('project:')을 잡아 동시에 와도 넘지 않게 한다
create function public.create_note(p_user_id uuid, p_title text, p_content text, p_budget_usd numeric default null)
returns public.study_notes
language plpgsql
set search_path = ''
as $$
declare
  q jsonb;
  result public.study_notes;
begin
  perform pg_advisory_xact_lock(hashtextextended('project:' || p_user_id::text, 0));
  if (select count(*) from public.study_notes where user_id = p_user_id) >= 3 then
    raise exception 'NOTE_LIMIT';
  end if;
  q := public.ai_quota(p_user_id, p_budget_usd);
  if q ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  if (q ->> 'gens_left')::int <= 0 then
    raise exception 'LIMIT_EXCEEDED';
  end if;
  insert into public.study_notes (user_id, title, content)
  values (p_user_id, p_title, p_content)
  returning * into result;
  insert into public.ai_usage (user_id, purpose, quota, status, ref_id)
  values (p_user_id, 'note_gen', 'project_gen', 'reserved', result.id);
  return result;
end;
$$;

-- 생성 결과 저장(save_project_questions와 같다). p_questions: [{ prompt, rubric: { keywords, criteria }, model_answer }] 5개.
-- null이면 실패(failed + p_error_code). 생성 중(generating)인 학습 자료에만 한 번 저장한다. 그사이 지워졌으면 NOT_FOUND
create function public.save_note_questions(p_note_id uuid, p_questions jsonb, p_error_code text)
returns public.study_notes
language plpgsql
set search_path = ''
as $$
declare
  n public.study_notes;
  q jsonb;
  qid int;
begin
  select * into n from public.study_notes where id = p_note_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if n.status <> 'generating' then
    raise exception 'NOT_GENERATING';
  end if;

  if p_questions is null then
    update public.study_notes set status = 'failed', error_code = coalesce(p_error_code, 'ai_failed')
    where id = n.id
    returning * into n;
    return n;
  end if;

  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> 5 then
    raise exception 'VALIDATION';
  end if;

  -- 프로젝트 질문처럼 참고 자료 링크를 넣지 않는다(모델이 만든 URL은 없는 주소일 수 있다)
  for q in select * from jsonb_array_elements(p_questions) loop
    insert into public.questions (prompt, note_id)
    values (q ->> 'prompt', n.id)
    returning id into qid;
    insert into public.question_keys (question_id, rubric, model_answer)
    values (qid, q -> 'rubric', q ->> 'model_answer');
  end loop;

  update public.study_notes set status = 'ready', error_code = null
  where id = n.id
  returning * into n;
  return n;
end;
$$;

-- 실패한 학습 자료의 질문 다시 생성. failed일 때만 generating으로 되돌린다.
-- 하루 한도는 다시 예약하지 않지만(처음 예약한 몫을 쓴다) 새 AI 호출이라 월 예산은 본다
create function public.restart_note_generation(p_user_id uuid, p_note_id uuid, p_budget_usd numeric default null)
returns public.study_notes
language plpgsql
set search_path = ''
as $$
declare
  n public.study_notes;
begin
  select * into n from public.study_notes where id = p_note_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if n.user_id is distinct from p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if n.status <> 'failed' then
    raise exception 'NOT_FAILED';
  end if;
  if public.ai_quota(p_user_id, p_budget_usd) ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  update public.study_notes set status = 'generating', error_code = null
  where id = n.id
  returning * into n;
  return n;
end;
$$;

-- 학습 자료 삭제(cascade). 오늘의 질문(daily)이 이 학습 자료의 질문이면 그날은 지우지 않는다(delete_project와 같은 이유).
-- start_daily_session과 같은 사용자 잠금을 잡아, 지우는 동안 그 질문으로 오늘 세션이 생기지 않게 한다
create function public.delete_note(p_user_id uuid, p_note_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  owner uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily:' || p_user_id::text, 0));
  select user_id into owner from public.study_notes where id = p_note_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if owner is distinct from p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if exists (
    select 1 from public.sessions s
    join public.questions q on q.id = s.question_id
    where s.user_id = p_user_id and s.kind = 'daily' and s.day = today and q.note_id = p_note_id
  ) then
    raise exception 'NOTE_IN_TODAY_SESSION';
  end if;
  delete from public.study_notes where id = p_note_id;
end;
$$;

-- 연습 세션은 프로젝트 질문과 같은 함수·같은 세션 종류(kind = 'project')를 쓴다. 바뀐 것은 주인 확인뿐이다:
-- 내 프로젝트의 질문이거나 내 학습 자료의 질문이면 된다. 하루 3세션 한도도 함께 센다(20261028090000과 나머지가 같다)
create or replace function public.start_project_session(p_user_id uuid, p_question_id int, p_budget_usd numeric default null)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  owner uuid;
  q jsonb;
  result public.sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily:' || p_user_id::text, 0));
  select coalesce(p.user_id, n.user_id) into owner
  from public.questions qq
  left join public.projects p on p.id = qq.project_id
  left join public.study_notes n on n.id = qq.note_id
  where qq.id = p_question_id and (qq.project_id is not null or qq.note_id is not null);
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if owner is distinct from p_user_id then
    raise exception 'NOT_OWNER';
  end if;

  select * into result from public.sessions
  where user_id = p_user_id and kind = 'project' and question_id = p_question_id and status = 'open'
  order by created_at desc
  limit 1;
  if found then
    return result;
  end if;

  q := public.ai_quota(p_user_id, p_budget_usd);
  if q ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  if (q ->> 'sessions_left')::int <= 0 then
    raise exception 'LIMIT_EXCEEDED';
  end if;

  insert into public.sessions (user_id, question_id, kind, day, grade_model)
  values (p_user_id, p_question_id, 'project', today,
    case when q ->> 'budget' = 'downgrade' then 'haiku' else 'sonnet' end)
  returning * into result;
  insert into public.turns (session_id, idx) values (result.id, 0);
  insert into public.ai_usage (user_id, purpose, quota, status, ref_id)
  values (p_user_id, 'grade', 'project_session', 'reserved', result.id);
  return result;
end;
$$;

-- 공유 카드의 주제: 학습 자료 질문이면 "내 학습 자료"(나머지는 20261027230000과 같다).
-- 주제(topic_name)가 비면 저장되지 않아 학습 자료 질문 세션은 공유하지 못했다
create or replace function public.create_share(p_user_id uuid, p_session_id uuid, p_streak int)
returns text
language plpgsql
set search_path = ''
as $$
declare
  result text;
begin
  insert into public.shares (session_id, nickname, topic_name, score, streak)
  select s.id,
    case when p.share_nickname then p.nickname end,
    case
      when q.project_id is not null then '내 프로젝트'
      when q.note_id is not null then '내 학습 자료'
      else t.name
    end,
    t0.score,
    greatest(coalesce(p_streak, 0), 0)
  from public.sessions s
  join public.turns t0 on t0.session_id = s.id and t0.idx = 0
  join public.questions q on q.id = s.question_id
  left join public.topics t on t.id = q.topic_id
  join public.profiles p on p.id = s.user_id
  where s.id = p_session_id and s.user_id = p_user_id and s.kind <> 'trial'
    and t0.score is not null
  on conflict (session_id) do update set nickname = excluded.nickname
  returning id into result;
  return result;
end;
$$;

revoke execute on function public.create_note(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.create_note(uuid, text, text, numeric) to service_role;
revoke execute on function public.save_note_questions(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_note_questions(uuid, jsonb, text) to service_role;
revoke execute on function public.restart_note_generation(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.restart_note_generation(uuid, uuid, numeric) to service_role;
revoke execute on function public.delete_note(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_note(uuid, uuid) to service_role;
