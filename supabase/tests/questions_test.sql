-- 질문 은행: 조건으로 조회, 숨긴 질문 제외, 브라우저에서는 질문·정답지를 못 읽는다(#28)
begin;
select plan(8);

insert into public.questions (id, topic_id, level, prompt, is_hidden) values
  (99901, 'jpa', 'mid', '테스트 질문: JPA N+1', false),
  (99902, 'jpa', 'basic', '테스트 질문: 영속성 컨텍스트', false),
  (99903, 'react', 'mid', '테스트 질문: useEffect', false),
  (99904, 'jpa', 'mid', '테스트 질문: 숨긴 질문', true);
insert into public.question_keys (question_id, rubric, model_answer) values
  (99901, '{"keywords": ["지연 로딩"], "criteria": ["원인"]}', '모범 답안');

select is(
  (select count(*) from public.bank_questions where id between 99901 and 99904 and field = 'backend' and topic_id = 'jpa' and level = 'mid'),
  1::bigint,
  '분야·주제·난이도로 질문을 고른다'
);
select is(
  (select count(*) from public.bank_questions where id between 99901 and 99904 and field = 'frontend'),
  1::bigint,
  '분야로 질문을 고른다'
);
select ok(
  not exists (select 1 from public.bank_questions where id = 99904),
  '숨긴 질문은 출제 후보에 없다'
);

set local role anon;
select is((select count(*) from public.questions), 0::bigint, '로그인 안 한 사람은 질문을 못 읽는다');
select throws_ok('select count(*) from public.bank_questions', '42501', null, '로그인 안 한 사람은 출제 후보를 못 읽는다');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*) from public.questions), 0::bigint, '로그인한 사람도 질문 전체를 못 읽는다');
select is((select count(*) from public.question_keys), 0::bigint, '모범 답안은 브라우저에서 못 읽는다');
select throws_ok(
  $$insert into public.questions (topic_id, level, prompt) values ('jpa', 'mid', '몰래 넣기')$$,
  '42501', null, '브라우저에서 질문을 넣을 수 없다'
);

select * from finish();
rollback;
