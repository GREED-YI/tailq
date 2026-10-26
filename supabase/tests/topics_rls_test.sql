-- topics: 로그인한 사람만 읽고, 아무도 브라우저에서 쓰지 못한다(08 설계 "RLS")
begin;
select plan(4);

set local role anon;
select is((select count(*) from public.topics), 0::bigint, '로그인 안 한 사람은 주제를 못 읽는다');
select throws_ok(
  $$insert into public.topics (id, field, name, sort) values ('x', 'cs', 'x', 99)$$,
  '42501', null, '로그인 안 한 사람은 주제를 못 쓴다'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select is((select count(*) from public.topics), 15::bigint, '로그인한 사람은 주제 15개를 읽는다');
select throws_ok(
  $$insert into public.topics (id, field, name, sort) values ('x', 'cs', 'x', 99)$$,
  '42501', null, '로그인한 사람도 주제를 못 쓴다'
);

select * from finish();
rollback;
