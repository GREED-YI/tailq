-- 질문 북마크(#35, 04 기능 명세 E-4)
begin;
select plan(9);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"name": "비비"}');

insert into public.questions (id, topic_id, level, prompt) values
  (99921, 'jpa', 'mid', '테스트 질문: 영속성 컨텍스트'),
  (99922, 'react', 'mid', '테스트 질문: 렌더링'),
  (99923, 'network', 'basic', '테스트 질문: HTTP');

select public.start_daily_session('00000000-0000-0000-0000-00000000000a', 99921, 'new');

-- 저장은 여러 번 불러도 한 행
select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 99921, true);
select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 99921, true);
select is(
  (select count(*) from public.bookmarks where user_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint,
  '같은 질문을 두 번 저장해도 북마크는 하나'
);

-- 내 세션에 나오지 않은 질문은 저장하지 못한다(북마크가 질문 읽기를 넓히므로)
select throws_ok(
  $$select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 99922, true)$$,
  'NOT_FOUND', '내 세션에 없는 질문은 북마크하지 못한다'
);
select throws_ok(
  $$select public.set_bookmark('00000000-0000-0000-0000-00000000000b', 99921, true)$$,
  'NOT_FOUND', '다른 사람 세션의 질문도 북마크하지 못한다'
);

-- 해제도 여러 번 불러도 된다
select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 99921, false);
select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 99921, false);
select is(
  (select count(*) from public.bookmarks where user_id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint,
  '해제하면 북마크가 없다(두 번 해제해도 에러 없음)'
);

select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 99921, true);
-- 정책 확인용: 세션 없이 북마크만 있는 질문(지금 쓰기 경로로는 생기지 않는다)
insert into public.bookmarks (user_id, question_id) values ('00000000-0000-0000-0000-00000000000b', 99923);

-- 브라우저에서는 자기 북마크만 읽고, 직접 쓰지 못한다
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select results_eq(
  'select question_id from public.bookmarks',
  $$values (99921)$$,
  '자기 북마크만 읽는다'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, question_id) values ('00000000-0000-0000-0000-00000000000a', 99922)$$,
  '42501', null, '브라우저에서 북마크를 직접 넣을 수 없다'
);
select is(
  (select count(*) from public.questions where id = 99923),
  0::bigint,
  '남의 북마크 질문은 읽지 못한다'
);

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select results_eq(
  'select id from public.questions where id between 99921 and 99923',
  $$values (99923)$$,
  '내 북마크에 있는 질문은 읽는다'
);
delete from public.bookmarks;
select is(
  (select count(*) from public.bookmarks where user_id = '00000000-0000-0000-0000-00000000000b'),
  1::bigint,
  '브라우저에서 북마크를 직접 지울 수 없다'
);

select * from finish();
rollback;
