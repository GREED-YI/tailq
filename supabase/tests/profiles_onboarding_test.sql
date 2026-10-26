-- profiles 온보딩 규칙: 동의와 주제·난이도 없이는 온보딩을 마칠 수 없다(04 기능 명세 "2. 온보딩")
begin;
select plan(6);

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000001a');

-- 쓰기는 서버(service_role)만 한다(08 설계 "데이터 읽고 쓰는 길")
set local role service_role;

select throws_ok(
  $$update public.profiles set onboarded_at = now(), topics = '{dsa}', levels = '{basic}'
    where id = '00000000-0000-0000-0000-00000000001a'$$,
  '23514', null, '동의하지 않으면 온보딩을 마칠 수 없다'
);
select throws_ok(
  $$update public.profiles set onboarded_at = now(), agreed_at = now(), levels = '{basic}'
    where id = '00000000-0000-0000-0000-00000000001a'$$,
  '23514', null, '주제를 고르지 않으면 온보딩을 마칠 수 없다'
);
select throws_ok(
  $$update public.profiles set onboarded_at = now(), agreed_at = now(), topics = '{dsa}'
    where id = '00000000-0000-0000-0000-00000000001a'$$,
  '23514', null, '난이도를 고르지 않으면 온보딩을 마칠 수 없다'
);
select throws_ok(
  $$update public.profiles set levels = '{basic,expert}'
    where id = '00000000-0000-0000-0000-00000000001a'$$,
  '23514', null, '없는 난이도는 넣을 수 없다'
);
select lives_ok(
  $$update public.profiles
    set agreed_at = now(), topics = '{dsa,react}', levels = '{basic,deep}', onboarded_at = now()
    where id = '00000000-0000-0000-0000-00000000001a'$$,
  '동의하고 주제·난이도를 고르면 온보딩을 마친다'
);
select throws_ok(
  $$update public.profiles set topics = '{}'
    where id = '00000000-0000-0000-0000-00000000001a'$$,
  '23514', null, '온보딩을 마친 뒤에는 연습 범위를 비울 수 없다'
);

select * from finish();
rollback;
