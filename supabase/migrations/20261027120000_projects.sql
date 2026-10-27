-- 내 프로젝트 기반 질문(#39, 04 기능 명세 9번, 08 설계 "내 프로젝트 질문 생성", 3장 "projects").
-- 등록은 바로 응답하고(generating), 질문 5개 생성은 서버가 뒤에서 한 뒤 save_project_questions로 저장한다.
-- 지우면 그 질문과 세션·턴·복습·북마크가 on delete cascade로 함께 지워진다.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  content text not null check (char_length(content) between 30 and 10000),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create index projects_user on public.projects (user_id, created_at);

-- 질문 은행과 프로젝트 질문을 한 테이블에 둔다. 프로젝트 질문은 세부 주제·난이도가 없어
-- 약점 리포트·연습 범위(bank_questions는 topics와 inner join)에서 저절로 빠진다
alter table public.questions
  alter column topic_id drop not null,
  alter column level drop not null,
  add column project_id uuid references public.projects (id) on delete cascade,
  add constraint questions_bank_or_project check (
    case
      when project_id is null then topic_id is not null and level is not null
      else topic_id is null and level is null and trial_field is null
    end
  );

create index questions_project on public.questions (project_id) where project_id is not null;

-- 읽기 정책만 두고 쓰기는 서버의 DB 함수로만 한다(08 설계 "데이터 읽고 쓰는 길")
alter table public.projects enable row level security;

create policy "projects: 자기 행만 읽기"
  on public.projects for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 질문 읽기 정책에 프로젝트를 더한다(08 설계 "questions 읽기 정책")
drop policy "questions: 내 세션·복습·북마크의 질문만 읽기" on public.questions;
create policy "questions: 내 세션·복습·북마크·프로젝트의 질문만 읽기"
  on public.questions for select
  to authenticated
  using (
    exists (select 1 from public.sessions s where s.question_id = questions.id and s.user_id = (select auth.uid()))
    or exists (select 1 from public.reviews r where r.question_id = questions.id and r.user_id = (select auth.uid()))
    or exists (select 1 from public.bookmarks b where b.question_id = questions.id and b.user_id = (select auth.uid()))
    or exists (select 1 from public.projects p where p.id = questions.project_id and p.user_id = (select auth.uid()))
  );

-- 프로젝트 등록. 사용자당 3개(04 기능 명세 9번). 동시에 와도 넘지 않게 사용자 잠금을 잡는다.
-- 하루 한도·월 예산 확인과 예약(ai_usage)은 하루 사용 상한(#43)에서 이 함수에 붙인다(08 설계 "하루 사용 한도와 월 예산")
create function public.create_project(p_user_id uuid, p_name text, p_content text)
returns public.projects
language plpgsql
set search_path = ''
as $$
declare
  result public.projects;
begin
  perform pg_advisory_xact_lock(hashtextextended('project:' || p_user_id::text, 0));
  if (select count(*) from public.projects where user_id = p_user_id) >= 3 then
    raise exception 'PROJECT_LIMIT';
  end if;
  insert into public.projects (user_id, name, content)
  values (p_user_id, p_name, p_content)
  returning * into result;
  return result;
end;
$$;

-- 생성 결과 저장. p_questions: [{ prompt, rubric: { keywords, criteria }, model_answer }] 5개(서버가 검증한 뒤 넘긴다).
-- null이면 실패(failed + p_error_code). 생성 중(generating)인 프로젝트에만 한 번 저장한다.
-- 그사이 지워졌으면 NOT_FOUND(서버는 기록만 남긴다)
create function public.save_project_questions(p_project_id uuid, p_questions jsonb, p_error_code text)
returns public.projects
language plpgsql
set search_path = ''
as $$
declare
  p public.projects;
  q jsonb;
  qid int;
begin
  select * into p from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if p.status <> 'generating' then
    raise exception 'NOT_GENERATING';
  end if;

  if p_questions is null then
    update public.projects set status = 'failed', error_code = coalesce(p_error_code, 'ai_failed')
    where id = p.id
    returning * into p;
    return p;
  end if;

  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> 5 then
    raise exception 'VALIDATION';
  end if;

  -- 프로젝트 질문에는 참고 자료 링크를 넣지 않는다(모델이 만든 URL은 없는 주소일 수 있다)
  for q in select * from jsonb_array_elements(p_questions) loop
    insert into public.questions (prompt, project_id)
    values (q ->> 'prompt', p.id)
    returning id into qid;
    insert into public.question_keys (question_id, rubric, model_answer)
    values (qid, q -> 'rubric', q ->> 'model_answer');
  end loop;

  update public.projects set status = 'ready', error_code = null
  where id = p.id
  returning * into p;
  return p;
end;
$$;

-- 실패한 프로젝트의 질문 다시 생성(POST /api/projects/{id}/generations). failed일 때만 generating으로 되돌린다.
-- 한도는 다시 예약하지 않는다(처음 예약한 몫을 쓴다, 08 설계)
create function public.restart_project_generation(p_user_id uuid, p_project_id uuid)
returns public.projects
language plpgsql
set search_path = ''
as $$
declare
  p public.projects;
begin
  select * into p from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if p.user_id is distinct from p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if p.status <> 'failed' then
    raise exception 'NOT_FAILED';
  end if;
  update public.projects set status = 'generating', error_code = null
  where id = p.id
  returning * into p;
  return p;
end;
$$;

-- 프로젝트 삭제(cascade). 오늘의 질문(daily)이 이 프로젝트의 질문이면 그날은 지우지 않는다.
-- 지우면 오늘 세션과 학습한 날이 사라지고 새 세션이 하나 더 생기기 때문이다(04 기능 명세 9번).
-- start_daily_session과 같은 사용자 잠금을 잡아, 지우는 동안 그 질문으로 오늘 세션이 생기지 않게 한다
create function public.delete_project(p_user_id uuid, p_project_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  owner uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily:' || p_user_id::text, 0));
  select user_id into owner from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if owner is distinct from p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if exists (
    select 1 from public.sessions s
    join public.questions q on q.id = s.question_id
    where s.user_id = p_user_id and s.kind = 'daily' and s.day = today and q.project_id = p_project_id
  ) then
    raise exception 'PROJECT_IN_TODAY_SESSION';
  end if;
  delete from public.projects where id = p_project_id;
end;
$$;

-- 프로젝트 질문 연습 세션. 내 프로젝트의 질문인지 확인하고, 그 질문으로 열린 세션이 있으면 이어간다
-- (프로젝트 질문 세션은 날짜가 바뀌어도 이어간다, 08 설계 "이어하기"). 없으면 세션 + 본 질문 턴을 만든다.
-- 하루 한도·월 예산 확인과 예약은 하루 사용 상한(#43)에서 새로 만들 때 붙인다
create function public.start_project_session(p_user_id uuid, p_question_id int)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  owner uuid;
  result public.sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily:' || p_user_id::text, 0));
  select p.user_id into owner
  from public.questions q join public.projects p on p.id = q.project_id
  where q.id = p_question_id;
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

  insert into public.sessions (user_id, question_id, kind, day)
  values (p_user_id, p_question_id, 'project', today)
  returning * into result;
  insert into public.turns (session_id, idx) values (result.id, 0);
  return result;
end;
$$;

revoke execute on function public.create_project(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_project(uuid, text, text) to service_role;
revoke execute on function public.save_project_questions(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_project_questions(uuid, jsonb, text) to service_role;
revoke execute on function public.restart_project_generation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.restart_project_generation(uuid, uuid) to service_role;
revoke execute on function public.delete_project(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_project(uuid, uuid) to service_role;
revoke execute on function public.start_project_session(uuid, int) from public, anon, authenticated;
grant execute on function public.start_project_session(uuid, int) to service_role;
