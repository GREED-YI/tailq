-- 꼬리질문 판정 저장(#32, 08 설계 "상태 전이표", 09 채점 "꼬리질문 채점").
-- save_grading이 본 질문(idx 0)뿐 아니라 꼬리질문(idx 1~3) 결과도 저장한다.
-- 꼬리질문 p_result: { verdict, feedback: { summary }, follow_up: { question, expected_answer } | null }
-- follow_up은 서버가 턴에 맞게 확인한 뒤 넘긴다(1번째는 반드시 있고, 2번째는 need_more일 때만, 3번째는 없다).
-- 다음 꼬리질문이 있으면 그 턴과 기대 답안을 만들고, 없으면 세션을 끝낸다.
-- 세션이 이미 닫혀 있으면(날짜를 넘겨 정리됨) 결과만 저장한다.
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
    review_day := public.apply_review(s.user_id, s.question_id, (p_result ->> 'score')::int >= 70);
  else
    update public.turns
    set status = 'graded', verdict = p_result ->> 'verdict', feedback = p_result -> 'feedback'
    where id = p_turn_id;
  end if;

  if s.status = 'open' then
    if t.idx < 3 and jsonb_typeof(p_result -> 'follow_up') = 'object' then
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

-- create or replace는 권한을 그대로 두지만, 08 설계대로 마이그레이션마다 명시한다
revoke execute on function public.save_grading(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_grading(uuid, jsonb) to service_role;
