-- 꼬리질문 판정 저장과 세션 종료(#32, 08 설계 "상태 전이표")
begin;
select plan(12);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"name": "비비"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"name": "씨씨"}');

insert into public.questions (id, topic_id, level, prompt) values
  (99901, 'jpa', 'mid', '테스트 질문: JPA N+1');

create function pg_temp.main(score int) returns jsonb language sql as $$
  select jsonb_build_object(
    'score', score,
    'feedback', jsonb_build_object('summary', '한 줄 평', 'good', '[]'::jsonb, 'improve', '["보완"]'::jsonb),
    'follow_up', jsonb_build_object('question', '꼬리질문 1?', 'expected_answer', '기대 답안 1'))
$$;
create function pg_temp.follow(verdict text, next text) returns jsonb language sql as $$
  select jsonb_build_object(
    'verdict', verdict,
    'feedback', jsonb_build_object('summary', '한 줄 피드백'),
    'follow_up', case when next is null then null
                 else jsonb_build_object('question', next, 'expected_answer', '기대 ' || next) end)
$$;
-- 사용자의 오늘 세션에서 idx번째 턴 id
create function pg_temp.turn(u uuid, i int) returns uuid language sql as $$
  select t.id from public.turns t join public.sessions s on s.id = t.session_id
  where s.user_id = u and t.idx = i
$$;
-- 본 질문을 채점까지 마친다(꼬리질문 1이 생긴다)
create function pg_temp.through_main(u uuid) returns void language plpgsql as $$
begin
  perform public.start_daily_session(u, 99901, 'new');
  perform public.submit_answer(pg_temp.turn(u, 0), u, repeat('가', 40), false);
  perform public.save_grading(pg_temp.turn(u, 0), pg_temp.main(50));
end;
$$;
create function pg_temp.answer(u uuid, i int, r jsonb) returns jsonb language plpgsql as $$
begin
  perform public.submit_answer(pg_temp.turn(u, i), u, repeat('나', 40), false);
  return public.save_grading(pg_temp.turn(u, i), r);
end;
$$;

-- A: 꼬리질문 3개를 끝까지
select pg_temp.through_main('00000000-0000-0000-0000-00000000000a');
create temp table r1 as
select pg_temp.answer('00000000-0000-0000-0000-00000000000a', 1, pg_temp.follow('partial', '꼬리질문 2?')) as r;
select is(
  (select (verdict, feedback ->> 'summary', score)::text from public.turns
   where id = pg_temp.turn('00000000-0000-0000-0000-00000000000a', 1)),
  '(partial,"한 줄 피드백",)',
  '꼬리질문은 점수 없이 판정과 한 줄 피드백을 저장한다'
);
select is(
  (select (t.idx, t.status, t.follow_up_prompt, k.expected_answer, r1.r ->> 'session_status')::text
   from r1, public.turns t join public.turn_keys k on k.turn_id = t.id
   where t.id = (r1.r ->> 'next_turn_id')::uuid),
  '(2,answering,"꼬리질문 2?","기대 꼬리질문 2?",open)',
  '다음 꼬리질문 턴과 기대 답안을 만든다'
);
select pg_temp.answer('00000000-0000-0000-0000-00000000000a', 2, pg_temp.follow('good', '꼬리질문 3?'));
create temp table r3 as
select pg_temp.answer('00000000-0000-0000-0000-00000000000a', 3, pg_temp.follow('wrong', '꼬리질문 4?')) as r;
select is(
  (select (r ->> 'next_turn_id', r ->> 'session_status')::text from r3),
  '(,done)',
  '3번째 꼬리질문 뒤에는 더 만들지 않고 세션을 끝낸다'
);
select is(
  (select count(*) from public.turns t join public.sessions s on s.id = t.session_id
   where s.user_id = '00000000-0000-0000-0000-00000000000a'),
  4::bigint,
  '턴은 본 질문 + 꼬리질문 3개까지'
);
select isnt(
  (select completed_at from public.sessions where user_id = '00000000-0000-0000-0000-00000000000a'),
  null,
  '끝난 시각을 남긴다'
);
select is(
  (select (box, due_day - (now() at time zone 'Asia/Seoul')::date)::text from public.reviews
   where user_id = '00000000-0000-0000-0000-00000000000a'),
  '(1,1)',
  '복습 칸은 본 질문 점수로만 정한다(꼬리질문 판정은 쓰지 않는다)'
);

-- B: 2번째에서 더 묻지 않음 → 꼬리질문 2개로 끝
select pg_temp.through_main('00000000-0000-0000-0000-00000000000b');
select pg_temp.answer('00000000-0000-0000-0000-00000000000b', 1, pg_temp.follow('good', '꼬리질문 2?'));
select is(
  (pg_temp.answer('00000000-0000-0000-0000-00000000000b', 2, pg_temp.follow('good', null)) ->> 'session_status'),
  'done',
  '다음 꼬리질문이 없으면 2개에서 세션을 끝낸다'
);
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000b', %L, false)$$,
         pg_temp.turn('00000000-0000-0000-0000-00000000000b', 2), repeat('가', 40)),
  'P0001', 'ALREADY_GRADED', '판정이 끝난 꼬리질문에는 다시 답할 수 없다'
);

-- C: 꼬리질문에서 모르겠어요 → 기대 답안은 그대로, 세션은 종합으로
select pg_temp.through_main('00000000-0000-0000-0000-00000000000c');
select is(
  (select (status, verdict, score, answer)::text from public.submit_answer(
     pg_temp.turn('00000000-0000-0000-0000-00000000000c', 1), '00000000-0000-0000-0000-00000000000c', null, true)),
  '(graded,unknown,,)',
  '꼬리질문에서 모르겠어요는 점수 없이 unknown으로 끝낸다'
);
select is(
  (select status from public.sessions where user_id = '00000000-0000-0000-0000-00000000000c'),
  'done',
  '꼬리질문에서 모르겠어요를 누르면 세션이 끝난다'
);

-- D: 채점 중에 세션이 닫히면(날짜를 넘김) 결과만 저장하고 다음 꼬리질문은 만들지 않는다
delete from public.sessions where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.through_main('00000000-0000-0000-0000-00000000000c');
select public.submit_answer(pg_temp.turn('00000000-0000-0000-0000-00000000000c', 1),
                            '00000000-0000-0000-0000-00000000000c', repeat('나', 40), false);
update public.sessions set status = 'done' where user_id = '00000000-0000-0000-0000-00000000000c';
create temp table rd as
select public.save_grading(pg_temp.turn('00000000-0000-0000-0000-00000000000c', 1),
                           pg_temp.follow('good', '꼬리질문 2?')) as r;
select is(
  (select (r ->> 'next_turn_id', r ->> 'session_status')::text from rd),
  '(,done)',
  '닫힌 세션에서는 다음 꼬리질문을 만들지 않는다'
);
select is(
  (select verdict from public.turns where id = pg_temp.turn('00000000-0000-0000-0000-00000000000c', 1)),
  'good',
  '닫힌 세션이어도 판정은 저장한다'
);

select * from finish();
rollback;
