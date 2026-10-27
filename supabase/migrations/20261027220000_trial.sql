-- 로그인 없는 체험과 이어받기(#40, 04 기능 명세 10번, 08 설계 2장 "체험과 이어받기").
-- 체험도 일반 세션과 같은 sessions·turns에 user_id 없이 trial_token(쿠키 값)으로 저장한다.
-- 서버가 쿠키 토큰과 IP의 HMAC(ip_hash)을 넘기고, 제한·소유 확인·상태 전이는 여기서 한다.
alter table public.sessions
  alter column user_id drop not null,
  add column trial_token text,
  -- 체험 IP의 HMAC(서버 비밀값). IP 원래 값은 저장하지 않는다. 이어받으면 null
  add column ip_hash text,
  -- 체험만 user_id가 없고 토큰이 있다. 이어받으면 daily가 되며 토큰·IP 해시를 지운다
  add constraint sessions_trial_owner check (
    case
      when kind = 'trial' then user_id is null and trial_token is not null
      else user_id is not null and trial_token is null and ip_hash is null
    end
  );

create index sessions_trial_token on public.sessions (trial_token) where trial_token is not null;
create index sessions_trial_ip on public.sessions (ip_hash, day) where kind = 'trial';

-- 체험 시작. 같은 브라우저(토큰)는 하루 1번, 같은 IP는 하루 20번(04 기능 명세 10번).
-- 오늘 이 브라우저의 체험이 아직 열려 있으면 그것을 돌려준다(새로고침·다시 누름). 끝났으면 TRIAL_LIMIT.
-- 질문은 trial_field가 그 분야인 샘플 질문(08 설계 "questions").
create function public.start_trial(p_trial_token text, p_ip_hash text, p_field text)
returns public.sessions
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  qid int;
  result public.sessions;
begin
  if p_field not in ('cs', 'backend', 'frontend') or coalesce(p_trial_token, '') = '' or coalesce(p_ip_hash, '') = '' then
    raise exception 'VALIDATION';
  end if;
  -- 같은 IP의 동시 요청을 한 줄로 세워 20번을 넘지 않게 한다(같은 브라우저도 같은 IP라 함께 묶인다)
  perform pg_advisory_xact_lock(hashtextextended('trial:' || p_ip_hash, 0));

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

  select id into qid from public.questions
  where trial_field = p_field and not is_hidden
  order by id
  limit 1;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.sessions (trial_token, ip_hash, question_id, kind, day)
  values (p_trial_token, p_ip_hash, qid, 'trial', today)
  returning * into result;
  insert into public.turns (session_id, idx) values (result.id, 0);
  return result;
end;
$$;

-- 답변 제출(20261026120000의 submit_answer)에 체험 토큰 소유 확인을 더한다.
-- 로그인 사용자는 p_user_id, 체험은 p_trial_token으로 확인한다. 체험 세션은 복습 칸을 만들지 않는다.
-- 체험은 사용자가 없어 p_user_id를 비울 수 있게 뒤 인자에 기본값을 둔다(앞 순서는 그대로라 기존 호출도 맞다)
drop function public.submit_answer(uuid, uuid, text, boolean);
create function public.submit_answer(
  p_turn_id uuid,
  p_user_id uuid default null,
  p_answer text default null,
  p_dont_know boolean default false,
  p_trial_token text default null
)
returns public.turns
language plpgsql
set search_path = ''
as $$
declare
  t public.turns;
  s public.sessions;
  regrades int;
  result public.turns;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into s from public.sessions where id = t.session_id;
  if not (
    coalesce(s.user_id = p_user_id, false)
    or coalesce(s.user_id is null and s.trial_token = p_trial_token, false)
  ) then
    raise exception 'NOT_OWNER';
  end if;
  if t.status in ('graded', 'skipped') then
    raise exception 'ALREADY_GRADED';
  end if;
  if s.status <> 'open' then
    raise exception 'SESSION_CLOSED';
  end if;
  if t.status = 'grading' and t.grading_started_at >= now() - interval '20 seconds' then
    raise exception 'GRADING_IN_PROGRESS';
  end if;

  if p_dont_know then
    update public.turns
    set status = 'graded', verdict = 'unknown', score = case when idx = 0 then 0 end,
        answer = null, feedback = null, answered_at = coalesce(answered_at, now())
    where id = p_turn_id
    returning * into result;
    if t.idx = 0 and s.user_id is not null then
      perform public.apply_review(s.user_id, s.question_id, false);
    end if;
    update public.sessions set status = 'done', completed_at = now() where id = s.id;
    return result;
  end if;

  if char_length(btrim(coalesce(p_answer, ''))) not between 30 and 2000 then
    raise exception 'VALIDATION';
  end if;

  if t.status <> 'answering' then
    select coalesce(sum(greatest(grading_attempts - 1, 0)), 0) into regrades
    from public.turns where session_id = s.id;
    if regrades >= 3 then
      raise exception 'REGRADE_LIMIT';
    end if;
  end if;

  update public.turns
  set answer = btrim(p_answer), status = 'grading', grading_started_at = now(),
      grading_attempts = grading_attempts + 1, answered_at = coalesce(answered_at, now())
  where id = p_turn_id
  returning * into result;
  return result;
end;
$$;

-- 채점 결과 저장(20261026160000의 save_grading). 체험은 복습 칸을 만들지 않고(사용자가 없다),
-- 꼬리질문은 1개까지라 꼬리질문 1을 판정하면 세션을 끝낸다(04 기능 명세 10번).
-- 체험 중에 이어받아 사용자가 생겼으면 그 뒤 저장되는 본 질문 결과는 복습 칸에 들어간다.
create or replace function public.save_grading(p_turn_id uuid, p_result jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  t public.turns;
  s public.sessions;
  next_id uuid;
  review_day date;
begin
  select * into t from public.turns where id = p_turn_id for update;
  if not found or t.status <> 'grading' then
    raise exception 'NOT_GRADING';
  end if;
  select * into s from public.sessions where id = t.session_id for update;

  if p_result is null then
    update public.turns set status = 'failed' where id = p_turn_id;
    return jsonb_build_object('next_turn_id', null, 'next_review_day', null, 'session_status', s.status);
  end if;

  if t.idx = 0 then
    update public.turns
    set status = 'graded', score = (p_result ->> 'score')::smallint, feedback = p_result -> 'feedback'
    where id = p_turn_id;
    if s.user_id is not null then
      review_day := public.apply_review(s.user_id, s.question_id, (p_result ->> 'score')::int >= 70);
    end if;
  else
    update public.turns
    set status = 'graded', verdict = p_result ->> 'verdict', feedback = p_result -> 'feedback'
    where id = p_turn_id;
  end if;

  if s.status = 'open' then
    if t.idx < (case when s.kind = 'trial' then 1 else 3 end)
       and jsonb_typeof(p_result -> 'follow_up') = 'object' then
      insert into public.turns (session_id, idx, follow_up_prompt)
      values (s.id, t.idx + 1, p_result -> 'follow_up' ->> 'question')
      returning id into next_id;
      insert into public.turn_keys (turn_id, expected_answer)
      values (next_id, p_result -> 'follow_up' ->> 'expected_answer');
    else
      update public.sessions set status = 'done', completed_at = now() where id = s.id
      returning * into s;
    end if;
  end if;

  return jsonb_build_object('next_turn_id', next_id, 'next_review_day', review_day, 'session_status', s.status);
end;
$$;

-- 이어받기(08 설계 2장). 로그인 직후 서버가 쿠키의 체험 토큰과 함께 부른다.
-- 처음 가입한 사용자(온보딩 전이고 세션이 하나도 없음)이고, 그 체험이 오늘(KST)이면
-- 오늘의 질문 세션(daily, new)으로 바꾸고 토큰·IP 해시를 지운다. 이어받지 않으면 null.
-- 본 질문을 제출했으면 꼬리질문 중이어도 done으로 닫고(남은 턴 skipped), 채점이 끝난 본 질문은 복습 칸에 넣는다.
-- 본 질문 채점이 아직 진행 중이면 save_grading이 바뀐 user_id로 복습 칸을 만든다.
create function public.adopt_trial(p_user_id uuid, p_trial_token text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  s public.sessions;
  main public.turns;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily:' || p_user_id::text, 0));

  select * into s from public.sessions
  where trial_token = p_trial_token and kind = 'trial' and day = today
  for update;
  if not found then
    return null;
  end if;
  if exists (select 1 from public.sessions where user_id = p_user_id)
     or exists (select 1 from public.profiles where id = p_user_id and onboarded_at is not null) then
    return null;
  end if;

  select * into main from public.turns where session_id = s.id and idx = 0;

  update public.sessions
  set user_id = p_user_id, kind = 'daily', pick = 'new', trial_token = null, ip_hash = null
  where id = s.id;

  if main.answered_at is not null and s.status = 'open' then
    update public.turns set status = 'skipped'
    where session_id = s.id and status = 'answering';
    update public.sessions set status = 'done', completed_at = now() where id = s.id;
  end if;

  if main.status = 'graded' then
    perform public.apply_review(p_user_id, s.question_id, main.verdict is distinct from 'unknown' and main.score >= 70);
  end if;

  return s.id;
end;
$$;

-- 이어받지 않은 체험 정리(08 설계 "체험과 이어받기", "보관 기간"). 매일 4시(KST)에 pg_cron이 부른다.
-- 이어받기는 체험한 날에만 되므로 지난 날의 체험 세션을 턴·기대 답안과 함께(cascade) 지운다.
create function public.cleanup_trials()
returns int
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.sessions
    where kind = 'trial' and day < (now() at time zone 'Asia/Seoul')::date
    returning 1
  )
  select count(*)::int from gone;
$$;

-- 매일 4시(KST) = 19시(UTC). 지표 이벤트 정리(purge-old-events)와 같은 시각에 pg_cron으로 돈다
select cron.schedule('cleanup-trials', '0 19 * * *', 'select public.cleanup_trials()');

revoke execute on function public.start_trial(text, text, text) from public, anon, authenticated;
grant execute on function public.start_trial(text, text, text) to service_role;
revoke execute on function public.submit_answer(uuid, uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, text, boolean, text) to service_role;
revoke execute on function public.save_grading(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_grading(uuid, jsonb) to service_role;
revoke execute on function public.adopt_trial(uuid, text) from public, anon, authenticated;
grant execute on function public.adopt_trial(uuid, text) to service_role;
revoke execute on function public.cleanup_trials() from public, anon, authenticated;
grant execute on function public.cleanup_trials() to service_role;
