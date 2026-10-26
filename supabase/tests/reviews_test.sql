-- 간격 반복 복습(#33, 04 기능 명세 5번, 09 채점 "복습 칸 옮기기")
begin;
select plan(15);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"name": "비비"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"name": "씨씨"}');

insert into public.questions (id, topic_id, level, prompt) values
  (99911, 'jpa', 'mid', '테스트 질문: 영속성 컨텍스트'),
  (99912, 'react', 'mid', '테스트 질문: 렌더링'),
  (99913, 'network', 'basic', '테스트 질문: HTTP');

-- (칸, 다음 복습까지 남은 날). 날짜는 한국 시간 기준
create function pg_temp.box_of(uid uuid, qid int) returns text language sql as $$
  select (box, due_day - (now() at time zone 'Asia/Seoul')::date)::text
  from public.reviews where user_id = uid and question_id = qid
$$;
create function pg_temp.result(score int) returns jsonb language sql as $$
  select jsonb_build_object(
    'score', score,
    'feedback', jsonb_build_object('summary', '한 줄 평', 'good', '[]'::jsonb, 'improve', '[]'::jsonb,
                                   'missing_keywords', '[]'::jsonb),
    'follow_up', jsonb_build_object('question', '꼬리질문?', 'expected_answer', '기대 답안'))
$$;
-- 오늘의 질문으로 열고 본 질문을 제출한 뒤 채점 결과를 저장한다
create function pg_temp.grade(uid uuid, qid int, score int) returns void language plpgsql as $$
declare
  sid uuid;
  turn uuid;
begin
  select id into sid from public.start_daily_session(uid, qid, 'new');
  select id into turn from public.turns where session_id = sid and idx = 0;
  perform public.submit_answer(turn, uid, repeat('가', 40), false);
  perform public.save_grading(turn, pg_temp.result(score));
end;
$$;

-- 칸 사다리: 처음 잘 답하면 2칸, 그 뒤 한 칸씩, 5칸에서 또 잘 답하면 익힘
select public.apply_review('00000000-0000-0000-0000-00000000000a', 99912, true);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000a', 99912), '(2,3)', '처음 잘 답하면 2칸, 3일 뒤');
select public.apply_review('00000000-0000-0000-0000-00000000000a', 99912, true);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000a', 99912), '(3,7)', '2칸 → 3칸, 7일 뒤');
select public.apply_review('00000000-0000-0000-0000-00000000000a', 99912, true);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000a', 99912), '(4,14)', '3칸 → 4칸, 14일 뒤');
select is(
  public.apply_review('00000000-0000-0000-0000-00000000000a', 99912, true) - (now() at time zone 'Asia/Seoul')::date,
  30,
  '4칸 → 5칸, 30일 뒤(돌려주는 날짜도 같다)'
);
select is(public.apply_review('00000000-0000-0000-0000-00000000000a', 99912, true), null, '5칸에서 잘 답하면 다음 복습일이 없다');
select is(
  (select box from public.reviews where user_id = '00000000-0000-0000-0000-00000000000a' and question_id = 99912),
  null,
  '익힌 질문은 칸이 비어 복습에서 빠진다'
);

-- 부족하면 어느 칸에서든 1칸
select public.apply_review('00000000-0000-0000-0000-00000000000a', 99911, false);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000a', 99911), '(1,1)', '처음 부족하면 1칸, 1일 뒤');
select public.apply_review('00000000-0000-0000-0000-00000000000a', 99911, true);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000a', 99911), '(2,3)', '1칸에서 잘 답하면 2칸, 3일 뒤');
update public.reviews set box = 4 where user_id = '00000000-0000-0000-0000-00000000000a' and question_id = 99911;
select public.apply_review('00000000-0000-0000-0000-00000000000a', 99911, false);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000a', 99911), '(1,1)', '4칸에서 부족하면 1칸으로');

-- "잘 답함"의 경계는 본 질문 70점
select pg_temp.grade('00000000-0000-0000-0000-00000000000b', 99913, 69);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000b', 99913), '(1,1)', '69점은 부족함, 1칸');
select pg_temp.grade('00000000-0000-0000-0000-00000000000c', 99913, 70);
select is(pg_temp.box_of('00000000-0000-0000-0000-00000000000c', 99913), '(2,3)', '70점은 잘 답함, 2칸');

-- 브라우저에서는 자기 복습만 읽고, 직접 쓰지 못한다
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select results_eq(
  'select question_id from public.reviews order by question_id',
  $$values (99911), (99912)$$,
  '자기 복습 행만 읽는다'
);
select results_eq(
  'select id from public.questions order by id',
  $$values (99911), (99912)$$,
  '복습에 있는 질문을 읽는다'
);
select throws_ok(
  $$insert into public.reviews (user_id, question_id, box, due_day)
    values ('00000000-0000-0000-0000-00000000000a', 99913, 5, '2000-01-01')$$,
  '42501', null, '복습 행을 직접 만들 수 없다'
);
update public.reviews set box = 5;
reset role;
select is(
  (select box from public.reviews where user_id = '00000000-0000-0000-0000-00000000000a' and question_id = 99911),
  1::smallint,
  '복습 칸을 직접 바꿀 수 없다'
);

select * from finish();
rollback;
