-- 답변 제출·채점 저장·복습 칸·평가(#31, 08 설계 "상태 전이표")
begin;
select plan(27);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"name": "비비"}');

insert into public.questions (id, topic_id, level, prompt) values
  (99901, 'jpa', 'mid', '테스트 질문: JPA N+1'),
  (99902, 'react', 'mid', '테스트 질문: useEffect'),
  (99903, 'network', 'basic', '테스트 질문: TCP');

create temp table s1 as
select * from public.start_daily_session('00000000-0000-0000-0000-00000000000a', 99901, 'new');
create temp table t0 as
select t.* from public.turns t join s1 on s1.id = t.session_id where t.idx = 0;

create function pg_temp.answer() returns text language sql as
$$ select repeat('가', 40) $$;
create function pg_temp.result(score int) returns jsonb language sql as $$
  select jsonb_build_object(
    'score', score,
    'feedback', jsonb_build_object('summary', '한 줄 평', 'good', '[]'::jsonb, 'improve', '["보완"]'::jsonb,
                                   'missing_keywords', '[]'::jsonb),
    'follow_up', jsonb_build_object('question', '꼬리질문?', 'expected_answer', '기대 답안'))
$$;

-- 제출
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000b', %L, false)$$,
         (select id from t0), pg_temp.answer()),
  'P0001', 'NOT_OWNER', '남의 턴에는 답할 수 없다'
);
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000a', %L, false)$$,
         (select id from t0), repeat('가', 29)),
  'P0001', 'VALIDATION', '30자 미만은 받지 않는다'
);
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000a', %L, false)$$,
         (select id from t0), repeat('가', 2001)),
  'P0001', 'VALIDATION', '2,000자 초과는 받지 않는다'
);
select is(
  (select (status, grading_attempts, answered_at is not null)::text
   from public.submit_answer((select id from t0), '00000000-0000-0000-0000-00000000000a', pg_temp.answer(), false)),
  '(grading,1,t)',
  '제출하면 grading, 시도 1, 답한 시각 기록'
);
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000a', %L, false)$$,
         (select id from t0), pg_temp.answer()),
  'P0001', 'GRADING_IN_PROGRESS', '20초 안의 채점이 있으면 다시 통과시키지 않는다'
);
update public.turns set grading_started_at = now() - interval '21 seconds' where id = (select id from t0);
select is(
  (select effective_status from public.turn_states where id = (select id from t0)),
  'failed',
  '20초를 넘긴 grading은 멈춘 채점(failed)으로 읽힌다'
);
select is(
  (select grading_attempts
   from public.submit_answer((select id from t0), '00000000-0000-0000-0000-00000000000a', pg_temp.answer(), false)),
  2::smallint,
  '멈춘 채점은 다시 채점으로 통과한다'
);

-- 실패 저장과 다시 채점 한도
select is(
  (public.save_grading((select id from t0), null) ->> 'next_turn_id'),
  null,
  '실패면 다음 턴을 만들지 않는다'
);
select is(
  (select (status, answer = pg_temp.answer())::text from public.turns where id = (select id from t0)),
  '(failed,t)',
  '실패해도 답변은 그대로 남는다'
);
select lives_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000a', %L, false)$$,
         (select id from t0), pg_temp.answer()),
  'failed 턴은 다시 채점할 수 있다'
);
select public.save_grading((select id from t0), null);
select public.submit_answer((select id from t0), '00000000-0000-0000-0000-00000000000a', pg_temp.answer(), false);
select public.save_grading((select id from t0), null);
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000a', %L, false)$$,
         (select id from t0), pg_temp.answer()),
  'P0001', 'REGRADE_LIMIT', '다시 채점은 세션당 3번까지'
);

-- 성공 저장 (한도를 넘긴 상태를 되돌리고 다시)
update public.turns set status = 'grading', grading_started_at = now(), grading_attempts = 1 where id = (select id from t0);
create temp table saved as select public.save_grading((select id from t0), pg_temp.result(82)) as r;
select is(
  (select (status, score, feedback ->> 'summary')::text from public.turns where id = (select id from t0)),
  '(graded,82,"한 줄 평")',
  '점수와 피드백을 저장하고 graded로'
);
select is(
  (select (t.idx, t.status, t.follow_up_prompt, k.expected_answer)::text
   from saved, public.turns t join public.turn_keys k on k.turn_id = t.id
   where t.id = (saved.r ->> 'next_turn_id')::uuid),
  '(1,answering,꼬리질문?,"기대 답안")',
  '꼬리질문 1 턴과 기대 답안을 만든다'
);
select is(
  (select (box, due_day - (now() at time zone 'Asia/Seoul')::date)::text from public.reviews
   where user_id = '00000000-0000-0000-0000-00000000000a' and question_id = 99901),
  '(2,3)',
  '처음 푼 질문을 70점 이상이면 2칸(3일 뒤)'
);
select is(
  (select (r ->> 'next_review_day')::date - (now() at time zone 'Asia/Seoul')::date from saved),
  3,
  '다음 복습일을 돌려준다'
);
select throws_ok(
  format($$select public.submit_answer(%L, '00000000-0000-0000-0000-00000000000a', %L, false)$$,
         (select id from t0), pg_temp.answer()),
  'P0001', 'ALREADY_GRADED', '채점이 끝난 턴에는 다시 답할 수 없다'
);
select throws_ok(
  format($$select public.save_grading(%L, %L::jsonb)$$, (select id from t0), pg_temp.result(90)),
  'P0001', 'NOT_GRADING', 'grading이 아닌 턴에는 결과를 저장하지 않는다'
);

-- 복습 칸 이동 규칙
select is(public.apply_review('00000000-0000-0000-0000-00000000000a', 99901, true) - (now() at time zone 'Asia/Seoul')::date, 7, '잘 답하면 한 칸 위(3칸, 7일 뒤)');
select is(public.apply_review('00000000-0000-0000-0000-00000000000a', 99901, false) - (now() at time zone 'Asia/Seoul')::date, 1, '부족하면 1칸(1일 뒤)');
update public.reviews set box = 5 where user_id = '00000000-0000-0000-0000-00000000000a' and question_id = 99901;
select is(public.apply_review('00000000-0000-0000-0000-00000000000a', 99901, true), null, '5칸에서 잘 답하면 익힌 질문(다음 복습 없음)');

-- 평가
select throws_ok(
  format($$select public.set_turn_rating(%L, '00000000-0000-0000-0000-00000000000b', 1::smallint)$$, (select id from t0)),
  'P0001', 'NOT_OWNER', '남의 턴은 평가할 수 없다'
);
select public.set_turn_rating((select id from t0), '00000000-0000-0000-0000-00000000000a', -1::smallint);
select is((select rating from public.turns where id = (select id from t0)), -1::smallint, '채점된 턴에 👎를 남긴다');

-- 모르겠어요
create temp table s2 as
select * from public.start_daily_session('00000000-0000-0000-0000-00000000000b', 99902, 'new');
select is(
  (select (status, verdict, score, answer is null)::text from public.submit_answer(
     (select t.id from public.turns t join s2 on s2.id = t.session_id where t.idx = 0),
     '00000000-0000-0000-0000-00000000000b', null, true)),
  '(graded,unknown,0,t)',
  '모르겠어요는 AI 없이 0점·unknown으로 끝낸다'
);
select is(
  (select (box, due_day - (now() at time zone 'Asia/Seoul')::date)::text from public.reviews
   where user_id = '00000000-0000-0000-0000-00000000000b' and question_id = 99902),
  '(1,1)',
  '모르겠어요는 복습 1칸(내일)'
);
select is(
  (select (s.status, t.answered_at is not null)::text from public.sessions s join public.turns t on t.session_id = s.id
   where s.id = (select id from s2) and t.idx = 0),
  '(done,t)',
  '세션은 끝나고 답한 날로 기록된다(학습한 날)'
);

-- 읽기: 기대 답안은 서버 전용, 턴 상태는 자기 것만
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is((select count(*) from public.turn_keys), 0::bigint, '로그인한 사용자도 기대 답안을 읽을 수 없다');
select is(
  (select count(distinct session_id) from public.turn_states),
  1::bigint,
  '턴 상태는 자기 세션 것만 읽힌다'
);
reset role;

select * from finish();
rollback;
