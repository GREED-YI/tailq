-- 실패한 질문 다시 생성(프로젝트·학습 자료)에 하루 한도(docs/10 보안 점검 "남용 제한", #99).
-- 처음엔 다시 생성은 월 예산만 봤다(20261028090000, 20261029120000). 생성이 거듭 실패하면 한 사람이 월 예산을 빨리 써서
-- 그 달 모든 사용자의 AI가 멈출 수 있어, 프로젝트와 학습 자료를 합쳐 한국 시간 하루 3번으로 묶는다(2026-10-28, 학습 자료는 2026-10-29).
-- 다른 하루 한도와 같은 방식이다: 사용자 잠금 안에서 ai_quota로 남은 몫을 보고, 몫을 reserved로 예약하면
-- 그 생성 호출의 기록(record_ai_usage)이 같은 행을 used·failed로 바꾼다.

alter table public.ai_usage drop constraint ai_usage_quota_check;
alter table public.ai_usage
  add constraint ai_usage_quota_check check (quota in ('project_session', 'project_gen', 'project_regen'));

-- 20261028090000과 같고 regens_left(다시 생성 남은 횟수)만 더했다
create or replace function public.ai_quota(p_user_id uuid, p_budget_usd numeric)
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
      count(*) filter (where u.quota = 'project_gen') as gens,
      count(*) filter (where u.quota = 'project_regen') as regens
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
    'sessions_left', greatest(3 - held.sessions, 0),
    'gens_left', greatest(1 - held.gens, 0),
    'regens_left', greatest(3 - held.regens, 0)
  )
  from spent, held;
$$;

-- 다시 생성: 실패한 내 프로젝트만 → 월 예산 → 하루 3번을 확인하고 몫을 예약한다.
-- 등록(create_project)과 같은 사용자 잠금을 잡아 동시에 눌러도 한도를 넘지 않는다
create or replace function public.restart_project_generation(p_user_id uuid, p_project_id uuid, p_budget_usd numeric default null)
returns public.projects
language plpgsql
set search_path = ''
as $$
declare
  p public.projects;
  q jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('project:' || p_user_id::text, 0));
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
  q := public.ai_quota(p_user_id, p_budget_usd);
  if q ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  if (q ->> 'regens_left')::int <= 0 then
    raise exception 'REGEN_LIMIT';
  end if;
  update public.projects set status = 'generating', error_code = null
  where id = p.id
  returning * into p;
  insert into public.ai_usage (user_id, purpose, quota, status, ref_id)
  values (p_user_id, 'project_gen', 'project_regen', 'reserved', p.id);
  return p;
end;
$$;

-- 학습 자료 다시 생성도 같은 몫(project_regen)을 센다. 등록(create_note)과 같은 사용자 잠금을 잡는다
create or replace function public.restart_note_generation(p_user_id uuid, p_note_id uuid, p_budget_usd numeric default null)
returns public.study_notes
language plpgsql
set search_path = ''
as $$
declare
  n public.study_notes;
  q jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('project:' || p_user_id::text, 0));
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
  q := public.ai_quota(p_user_id, p_budget_usd);
  if q ->> 'budget' = 'exceeded' then
    raise exception 'BUDGET_EXCEEDED';
  end if;
  if (q ->> 'regens_left')::int <= 0 then
    raise exception 'REGEN_LIMIT';
  end if;
  update public.study_notes set status = 'generating', error_code = null
  where id = n.id
  returning * into n;
  insert into public.ai_usage (user_id, purpose, quota, status, ref_id)
  values (p_user_id, 'note_gen', 'project_regen', 'reserved', n.id);
  return n;
end;
$$;

revoke execute on function public.ai_quota(uuid, numeric) from public, anon, authenticated;
grant execute on function public.ai_quota(uuid, numeric) to service_role;
revoke execute on function public.restart_project_generation(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.restart_project_generation(uuid, uuid, numeric) to service_role;
revoke execute on function public.restart_note_generation(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.restart_note_generation(uuid, uuid, numeric) to service_role;
