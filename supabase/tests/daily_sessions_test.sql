-- 오늘의 질문 세션: 하루 1세션, 전날 세션 정리, 자기 것만 읽기(#30, 08 설계 "start_daily_session")
begin;
select plan(19);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"name": "비비"}');

insert into public.questions (id, topic_id, level, prompt) values
  (99901, 'jpa', 'mid', '테스트 질문: JPA N+1'),
  (99902, 'react', 'mid', '테스트 질문: useEffect'),
  (99903, 'network', 'basic', '테스트 질문: TCP'),
  (99904, 'os', 'basic', '테스트 질문: 프로세스');
insert into public.question_keys (question_id, rubric, model_answer) values
  (99901, '{"keywords": ["지연 로딩"], "criteria": ["원인"]}', '모범 답안');

-- 하루 1세션
create temp table first_call as
select * from public.start_daily_session('00000000-0000-0000-0000-00000000000a', 99901, 'new');

select is(
  (select (question_id, pick, kind, status, day = (now() at time zone 'Asia/Seoul')::date)::text from first_call),
  '(99901,new,daily,open,t)',
  '고른 질문으로 오늘(한국 시간) 세션을 연다'
);
select is(
  (select (t.idx, t.status)::text from public.turns t join first_call f on f.id = t.session_id),
  '(0,answering)',
  '본 질문 턴을 함께 만든다'
);
select is(
  (select id from public.start_daily_session('00000000-0000-0000-0000-00000000000a', 99902, 'review')),
  (select id from first_call),
  '같은 날 다시 부르면 다른 질문을 넘겨도 처음 세션을 돌려준다'
);
select is(
  (select count(*) from public.sessions where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint,
  '하루에 세션은 하나다'
);
select throws_ok(
  $$insert into public.sessions (user_id, question_id, kind, pick, day)
    values ('00000000-0000-0000-0000-00000000000a', 99902, 'daily', 'new', (now() at time zone 'Asia/Seoul')::date)$$,
  '23505', null, '같은 날 daily 세션을 하나 더 넣을 수 없다(동시 요청도 하나만 남는다)'
);

-- 지난 날 열린 세션 정리
-- 어제: 본 질문을 안 냄 → expired / 그제: 본 질문 제출, 채점 중, 꼬리질문 1 답하는 중 → done
insert into public.sessions (id, user_id, question_id, kind, pick, day) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 99903, 'daily', 'new',
   (now() at time zone 'Asia/Seoul')::date - 1),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b', 99904, 'daily', 'review',
   (now() at time zone 'Asia/Seoul')::date - 2);
insert into public.turns (session_id, idx, follow_up_prompt, status, answered_at, grading_started_at) values
  ('00000000-0000-0000-0000-0000000000c1', 0, null, 'answering', null, null),
  ('00000000-0000-0000-0000-0000000000c2', 0, null, 'grading', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000c2', 1, '꼬리질문', 'answering', null, null);
insert into public.reviews (user_id, question_id, box, due_day) values
  ('00000000-0000-0000-0000-00000000000b', 99903, 1, (now() at time zone 'Asia/Seoul')::date - 1);

select is(
  (select question_id from public.start_daily_session('00000000-0000-0000-0000-00000000000b', 99903, 'review')),
  99903,
  '지난 세션을 정리하고 오늘 세션을 새로 연다(어제 놓친 복습 질문도 다시 낼 수 있다)'
);
select is(
  (select (status, completed_at is null)::text from public.sessions where id = '00000000-0000-0000-0000-0000000000c1'),
  '(expired,t)',
  '본 질문을 내지 않은 어제 세션은 expired'
);
select is(
  (select (status, completed_at is not null)::text from public.sessions where id = '00000000-0000-0000-0000-0000000000c2'),
  '(done,t)',
  '본 질문을 낸 지난 세션은 done'
);
select results_eq(
  $$select idx::int, status from public.turns where session_id = '00000000-0000-0000-0000-0000000000c2' order by idx$$,
  $$values (0, 'grading'), (1, 'skipped')$$,
  '남은 꼬리질문은 skipped, 채점 중인 턴은 건드리지 않는다'
);
select is(
  (select (box, due_day = (now() at time zone 'Asia/Seoul')::date - 1)::text
   from public.reviews where user_id = '00000000-0000-0000-0000-00000000000b' and question_id = 99903),
  '(1,t)',
  '세션이 만료돼도 복습 일정은 그대로 남는다'
);
select is(
  (select count(*) from public.sessions
   where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'open'),
  1::bigint,
  '열린 세션은 오늘 것 하나뿐이다'
);

-- 브라우저에서는 자기 것만 읽고, 쓰거나 함수를 부르지 못한다
set local role anon;
select is((select count(*) from public.sessions), 0::bigint, '로그인 안 한 사람은 세션을 못 읽는다');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select results_eq(
  'select question_id from public.sessions',
  $$values (99901)$$,
  '자기 세션만 읽는다'
);
select is(
  (select count(*) from public.turns),
  1::bigint,
  '자기 세션의 턴만 읽는다'
);
select results_eq(
  'select id from public.questions order by id',
  $$values (99901)$$,
  '질문은 내 세션에 나온 것만 읽는다'
);
select is((select count(*) from public.question_keys), 0::bigint, '모범 답안은 여전히 못 읽는다');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select results_eq(
  'select id from public.questions order by id',
  $$values (99903), (99904)$$,
  '내 세션·복습에 나온 질문을 읽는다'
);
select throws_ok(
  $$insert into public.sessions (user_id, question_id, kind, pick, day)
    values ('00000000-0000-0000-0000-00000000000b', 99901, 'daily', 'new', '2000-01-01')$$,
  '42501', null, '브라우저에서 세션을 직접 만들 수 없다'
);
select throws_ok(
  $$select public.start_daily_session('00000000-0000-0000-0000-00000000000b', 99901, 'new')$$,
  '42501', null, '브라우저에서 세션 함수를 부를 수 없다'
);

select * from finish();
rollback;
