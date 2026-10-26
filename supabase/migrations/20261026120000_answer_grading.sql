-- 답변 제출과 AI 채점(08 설계 2장 "상태 전이표", 3장 "DB 함수"). 서버가 로그인을 확인한 뒤
-- service_role로 부른다. 채점 자체(Claude 호출)는 서버가 하고, 여기서는 상태 전이와 저장만 묶는다.

-- 꼬리질문 기대 답안. 읽기 정책이 없는 서버 전용 테이블("모범 답안과 기대 답안 보호")
create table public.turn_keys (
  turn_id uuid primary key references public.turns (id) on delete cascade,
  expected_answer text not null check (char_length(expected_answer) > 0)
);
alter table public.turn_keys enable row level security;

-- 멈춘 채점: grading이 20초를 넘기면 failed처럼 본다. 화면과 함수가 같은 기준을 쓴다.
-- security_invoker라 turns의 RLS(자기 세션의 턴만)를 그대로 따른다.
create view public.turn_states
with (security_invoker = true) as
select t.*,
  case
    when t.status = 'grading' and t.grading_started_at < now() - interval '20 seconds' then 'failed'
    else t.status
  end as effective_status
from public.turns t;

revoke all on public.turn_states from anon;

-- 복습 칸 옮기기(04 기능 명세 5번, 09 채점 "복습 칸 옮기기").
-- 잘 답함: 처음 푼 질문은 2칸, 이미 있으면 한 칸 위, 5칸에서 또 잘 답하면 익힘(box null).
-- 부족함·모르겠어요: 1칸. 다음 복습일은 칸마다 1·3·7·14·30일 뒤.
create function public.apply_review(p_user_id uuid, p_question_id int, p_good boolean)
returns date
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  current_box smallint;
  had_row boolean;
  next_box smallint;
  next_day date;
begin
  select box, true into current_box, had_row
  from public.reviews
  where user_id = p_user_id and question_id = p_question_id
  for update;

  if not p_good then
    next_box := 1;
  elsif not coalesce(had_row, false) then
    next_box := 2;
  elsif current_box is null or current_box = 5 then
    next_box := null;
  else
    next_box := current_box + 1;
  end if;

  next_day := today + case next_box when 1 then 1 when 2 then 3 when 3 then 7 when 4 then 14 when 5 then 30 else 0 end;

  insert into public.reviews (user_id, question_id, box, due_day)
  values (p_user_id, p_question_id, next_box, next_day)
  on conflict (user_id, question_id) do update set box = excluded.box, due_day = excluded.due_day;

  return case when next_box is null then null else next_day end;
end;
$$;

-- 답변 제출. 한 요청만 grading으로 통과시킨다(08 설계 "채점은 한 요청만 통과한다").
-- 실패는 예외 메시지에 에러 코드를 담는다(서버가 HTTP 상태로 바꾼다).
-- p_dont_know면 AI 없이 바로 graded(unknown). 본 질문이면 0점·복습 1칸, 세션은 끝난다.
create function public.submit_answer(p_turn_id uuid, p_user_id uuid, p_answer text, p_dont_know boolean)
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
  if s.user_id is distinct from p_user_id then
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
    if t.idx = 0 then
      perform public.apply_review(s.user_id, s.question_id, false);
    end if;
    update public.sessions set status = 'done', completed_at = now() where id = s.id;
    return result;
  end if;

  if char_length(btrim(coalesce(p_answer, ''))) not between 30 and 2000 then
    raise exception 'VALIDATION';
  end if;

  -- 다시 채점(failed·멈춘 grading에서 다시 낸 것)은 세션당 3번까지(09 채점 "하루 한도와 다시 채점").
  -- 오늘의 질문 세션은 하루 하나라 세션당 = 하루당이다
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

-- 채점 결과 저장. p_result가 null이면 실패(failed, 답변은 그대로)로 둔다.
-- p_result: { score, feedback, follow_up: { question, expected_answer } } (본 질문, 09 채점 3장)
-- 본 질문이면 복습 칸을 옮기고, 세션이 아직 열려 있으면 꼬리질문 1 턴과 기대 답안을 만든다.
-- 돌려주는 값: { next_turn_id, next_review_day, session_status }
create function public.save_grading(p_turn_id uuid, p_result jsonb)
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

  if t.idx <> 0 then
    raise exception 'NOT_SUPPORTED';
  end if;

  update public.turns
  set status = 'graded', score = (p_result ->> 'score')::smallint, feedback = p_result -> 'feedback'
  where id = p_turn_id;

  review_day := public.apply_review(s.user_id, s.question_id, (p_result ->> 'score')::int >= 70);

  if s.status = 'open' then
    insert into public.turns (session_id, idx, follow_up_prompt)
    values (s.id, 1, p_result -> 'follow_up' ->> 'question')
    returning id into next_id;
    insert into public.turn_keys (turn_id, expected_answer)
    values (next_id, p_result -> 'follow_up' ->> 'expected_answer');
  end if;

  return jsonb_build_object('next_turn_id', next_id, 'next_review_day', review_day, 'session_status', s.status);
end;
$$;

-- 👍/👎. 채점이 끝난 자기 턴에만 남긴다
create function public.set_turn_rating(p_turn_id uuid, p_user_id uuid, p_rating smallint)
returns void
language plpgsql
set search_path = ''
as $$
declare
  owner uuid;
  turn_status text;
begin
  select s.user_id, t.status into owner, turn_status
  from public.turns t join public.sessions s on s.id = t.session_id
  where t.id = p_turn_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if owner is distinct from p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if turn_status <> 'graded' then
    raise exception 'NOT_GRADED';
  end if;
  update public.turns set rating = p_rating where id = p_turn_id;
end;
$$;

revoke execute on function public.apply_review(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.apply_review(uuid, int, boolean) to service_role;
revoke execute on function public.submit_answer(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, text, boolean) to service_role;
revoke execute on function public.save_grading(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_grading(uuid, jsonb) to service_role;
revoke execute on function public.set_turn_rating(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.set_turn_rating(uuid, uuid, smallint) to service_role;
