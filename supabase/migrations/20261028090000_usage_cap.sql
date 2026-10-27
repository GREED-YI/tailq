-- 하루 사용 상한과 월 예산(#43, 04 기능 명세 12장, 08 설계 "하루 사용 한도와 월 예산", 09 채점 5장).
-- - ai_usage: AI 호출 한 번이 한 행(used·failed, 토큰·비용·지연). 개인 하루 한도의 몫은 시작할 때 reserved로 잡고,
--   그 몫의 첫 호출이 같은 행을 used·failed로 바꾼다. AI를 쓰지 않고 끝나면(본 질문 "모르겠어요") released로 돌려준다.
-- - 개인 하루 한도(09 채점 "하루 한도와 다시 채점"): 프로젝트 질문 생성 1회, 프로젝트 질문 연습 3세션. 오늘의 질문은 걸지 않는다.
--   다시 채점은 기존처럼 submit_answer가 세션당 3번으로 묶는다.
-- - 월 예산은 서버 환경변수(AI_MONTHLY_BUDGET_USD)라 시작 함수가 p_budget_usd로 받는다. 이번 달(KST) 실제 비용 합이
--   예산에 닿으면 BUDGET_EXCEEDED, 80%를 넘으면 새 세션의 본 질문 채점 모델을 haiku로 정해 세션에 저장한다.
--   p_budget_usd가 null이면 예산을 보지 않는다(기존 테스트 호출용. 서버는 항상 넘긴다).
-- ponytail: 예산은 예약하지 않고 실제 비용만 더한다. 동시에 시작한 세션 몇 개만큼(세션당 약 $0.01) 넘을 수 있는데,
--   "이미 시작한 세션은 끝까지"라 어차피 조금 넘는 브레이크다. 정확해야 하면 시작할 때 예상 비용을 예약한다.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  -- 탈퇴하면 비워 비용 합계만 남긴다(08 설계 "탈퇴"). 체험이면 처음부터 null
  user_id uuid references auth.users (id) on delete set null,
  purpose text not null check (purpose in ('grade', 'follow_up', 'project_gen', 'trial')),
  -- 개인 하루 한도의 몫을 잡은 행만 값이 있다
  quota text check (quota in ('project_session', 'project_gen')),
  status text not null check (status in ('reserved', 'used', 'released', 'failed')),
  -- 세션 또는 프로젝트 id. 외래키로 묶지 않아 지워도 그날 쓴 양이 줄지 않는다
  ref_id uuid,
  model text,
  error_code text,
  latency_ms int,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  cost_usd numeric(12, 6) not null default 0,
  -- 한국 시간 날짜
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now()
);
-- 정책을 두지 않아 서버(service_role)만 읽고 쓴다(08 설계 "RLS")
alter table public.ai_usage enable row level security;

create index ai_usage_day on public.ai_usage (day);
create index ai_usage_quota on public.ai_usage (user_id, day) where quota is not null;
create index ai_usage_reserved on public.ai_usage (ref_id) where status = 'reserved';

-- 세션을 시작할 때 정한 본 질문 채점 모델. 세션 중간에 바뀌지 않는다(08 설계)
alter table public.sessions
  add column grade_model text not null default 'sonnet' check (grade_model in ('sonnet', 'haiku'));

-- 남은 한도와 예산 상태. 시작 함수와 화면(시작 버튼 대신 안내를 보일지)이 같은 기준을 쓴다.
-- { budget: ok·downgrade·exceeded, spent_usd, sessions_left, gens_left }
create function public.ai_quota(p_user_id uuid, p_budget_usd numeric)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Asia/Seoul')::date as d
  ), spent as (
    select coalesce(sum(u.cost_usd), 0) as usd
    from public.ai_usage u, today
    where u.day >= date_trunc('month', today.d)::date
  ), held as (
    select
      count(*) filter (where u.quota = 'project_session') as sessions,
      count(*) filter (where u.quota = 'project_gen') as gens
    from public.ai_usage u, today
    where u.user_id = p_user_id and u.day = today.d and u.quota is not null and u.status <> 'released'
  )
  select jsonb_build_object(
    'budget', case
      when p_budget_usd is null then 'ok'
      when spent.usd >= p_budget_usd then 'exceeded'
      when spent.usd > p_budget_usd * 0.8 then 'downgrade'
      else 'ok'
    end,
    'spent_usd', spent.usd,
    -- 09 채점 "하루 한도와 다시 채점": 프로젝트 질문 연습 3세션, 프로젝트 질문 생성 1회
    'sessions_left', greatest(3 - held.sessions, 0),
    'gens_left', greatest(1 - held.gens, 0)
  )
  from spent, held;
$$;

-- AI 호출 한 번의 기록. 같은 ref_id·purpose로 잡아 둔 몫(reserved)이 있으면 그 행을 바꾸고, 없으면 새 행.
-- p_usage: { status: used·failed, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, error_code, latency_ms }
create function public.record_ai_usage(p_user_id uuid, p_purpose text, p_ref_id uuid, p_usage jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  held bigint;
begin
  if p_usage ->> 'status' not in ('used', 'failed') then
    raise exception 'VALIDATION';
  end if;
  select id into held from public.ai_usage
  where ref_id = p_ref_id and purpose = p_purpose and status = 'reserved'
  order by id
  limit 1
  for update;
  if not found then
    insert into public.ai_usage (user_id, purpose, ref_id, status)
    values (p_user_id, p_purpose, p_ref_id, 'used')
    returning id into held;
  end if;
  update public.ai_usage set
    status = p_usage ->> 'status',
    model = p_usage ->> 'model',
    error_code = p_usage ->> 'error_code',
    latency_ms = (p_usage ->> 'latency_ms')::int,
    input_tokens = (p_usage ->> 'input_tokens')::int,
    output_tokens = (p_usage ->> 'output_tokens')::int,
    cache_read_tokens = (p_usage ->> 'cache_read_tokens')::int,
    cache_write_tokens = (p_usage ->> 'cache_write_tokens')::int,
    cost_usd = coalesce((p_usage ->> 'cost_usd')::numeric, 0)
  where id = held;
end;
$$;

-- 오늘의 질문 세션: 개인 한도는 보지 않고, 새로 만들 때만 월 예산을 본다(이미 있는 오늘 세션은 그대로 돌려준다).
drop function public.start_daily_session(uuid, int, text);
create function public.start_daily_session(p_user_id uuid, p_question_id int, p_pick text, p_budget_usd numeric default null)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  result public.sessions;
  budget text;
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

  budget := public.ai_quota(null, p_budget_usd) ->> 'budget';
  if budget = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;

  insert into public.sessions (user_id, question_id, kind, pick, day, grade_model)
  values (p_user_id, p_question_id, 'daily', p_pick, today, case when budget = 'downgrade' then 'haiku' else 'sonnet' end)
  returning * into result;

  insert into public.turns (session_id, idx) values (result.id, 0);

  return result;
end;
$$;

-- 프로젝트 질문 연습 세션: 열린 세션을 이어 할 때는 한도를 보지 않는다(시작한 세션은 끝까지).
-- 새로 만들 때 월 예산 → 하루 3세션을 확인하고 본 질문 채점 몫을 예약한다. 사용자 잠금 안에서 세므로 두 탭이 동시에 와도 넘지 않는다
drop function public.start_project_session(uuid, int);
create function public.start_project_session(p_user_id uuid, p_question_id int, p_budget_usd numeric default null)
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

-- 프로젝트 등록: 3개 제한 → 월 예산 → 하루 1회를 확인하고 질문 생성 몫을 예약한다
drop function public.create_project(uuid, text, text);
create function public.create_project(p_user_id uuid, p_name text, p_content text, p_budget_usd numeric default null)
returns public.projects
language plpgsql
set search_path = ''
as $$
declare
  q jsonb;
  result public.projects;
begin
  perform pg_advisory_xact_lock(hashtextextended('project:' || p_user_id::text, 0));
  if (select count(*) from public.projects where user_id = p_user_id) >= 3 then
    raise exception 'PROJECT_LIMIT';
  end if;
  q := public.ai_quota(p_user_id, p_budget_usd);
  if q ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  if (q ->> 'gens_left')::int <= 0 then
    raise exception 'LIMIT_EXCEEDED';
  end if;
  insert into public.projects (user_id, name, content)
  values (p_user_id, p_name, p_content)
  returning * into result;
  insert into public.ai_usage (user_id, purpose, quota, status, ref_id)
  values (p_user_id, 'project_gen', 'project_gen', 'reserved', result.id);
  return result;
end;
$$;

-- 다시 생성: 하루 한도는 다시 예약하지 않지만(처음 예약한 몫을 쓴다) 새 AI 호출이라 월 예산은 본다
drop function public.restart_project_generation(uuid, uuid);
create function public.restart_project_generation(p_user_id uuid, p_project_id uuid, p_budget_usd numeric default null)
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
  if public.ai_quota(p_user_id, p_budget_usd) ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  update public.projects set status = 'generating', error_code = null
  where id = p.id
  returning * into p;
  return p;
end;
$$;

-- 체험(20261027220000과 같다): 오늘 이 브라우저의 열린 체험은 그대로 돌려주고, 새로 만들 때만 월 예산을 본다.
-- 체험은 개인 한도가 없고(브라우저 1번·IP 20번은 그대로), 80%를 넘었으면 본 질문을 Haiku로 채점한다
drop function public.start_trial(text, text, text);
create function public.start_trial(p_trial_token text, p_ip_hash text, p_field text, p_budget_usd numeric default null)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  qid int;
  budget text;
  result public.sessions;
begin
  if p_field not in ('cs', 'backend', 'frontend') or coalesce(p_trial_token, '') = '' or coalesce(p_ip_hash, '') = '' then
    raise exception 'VALIDATION';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('trial:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('trial-token:' || p_trial_token, 0));

  select * into result from public.sessions
  where trial_token = p_trial_token and kind = 'trial' and day = today;
  if found then
    if result.status = 'open' then
      return result;
    end if;
    raise exception 'TRIAL_LIMIT';
  end if;

  if (select count(*) from public.sessions where ip_hash = p_ip_hash and kind = 'trial' and day = today) >= 20 then
    raise exception 'TRIAL_LIMIT';
  end if;

  budget := public.ai_quota(null, p_budget_usd) ->> 'budget';
  if budget = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;

  select id into qid from public.questions
  where trial_field = p_field and not is_hidden
  order by id
  limit 1;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.sessions (trial_token, ip_hash, question_id, kind, day, grade_model)
  values (p_trial_token, p_ip_hash, qid, 'trial', today, case when budget = 'downgrade' then 'haiku' else 'sonnet' end)
  returning * into result;
  insert into public.turns (session_id, idx) values (result.id, 0);
  return result;
end;
$$;

-- 잡아 둔 몫을 돌려준다. 본 질문을 "모르겠어요"로 끝내 AI를 쓰지 않은 세션이면 서버가 부른다.
-- 실패해도 그날 몫 하나가 덜 남을 뿐 비용은 새지 않는다
create function public.release_ai_usage(p_ref_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.ai_usage set status = 'released' where ref_id = p_ref_id and status = 'reserved';
$$;

revoke execute on function public.ai_quota(uuid, numeric) from public, anon, authenticated;
grant execute on function public.ai_quota(uuid, numeric) to service_role;
revoke execute on function public.record_ai_usage(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, text, uuid, jsonb) to service_role;
revoke execute on function public.start_daily_session(uuid, int, text, numeric) from public, anon, authenticated;
grant execute on function public.start_daily_session(uuid, int, text, numeric) to service_role;
revoke execute on function public.start_project_session(uuid, int, numeric) from public, anon, authenticated;
grant execute on function public.start_project_session(uuid, int, numeric) to service_role;
revoke execute on function public.create_project(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.create_project(uuid, text, text, numeric) to service_role;
revoke execute on function public.restart_project_generation(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.restart_project_generation(uuid, uuid, numeric) to service_role;
revoke execute on function public.start_trial(text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.start_trial(text, text, text, numeric) to service_role;
revoke execute on function public.release_ai_usage(uuid) from public, anon, authenticated;
grant execute on function public.release_ai_usage(uuid) to service_role;
