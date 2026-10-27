-- profiles: 가입하면 트리거가 행을 만들고, 사용자는 자기 행만 읽는다(08 설계 "RLS")
begin;
select plan(10);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "  김테일  ", "avatar_url": "https://example.com/a.png"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"user_name": "octocat-with-a-very-long-login"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"name": "윤"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"picture": "https://example.com/d.png"}');

select is(
  (select nickname from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  '김테일', '닉네임은 소셜 이름에서 앞뒤 공백을 뺀다'
);
select is(
  (select avatar from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'https://example.com/a.png', '아바타는 소셜 사진을 쓴다'
);
select is(
  (select nickname from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'octocat-with', '이름이 없으면 아이디를 쓰고 12자로 자른다'
);
select is(
  (select nickname from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  '면접 준비생', '2자보다 짧으면 기본 닉네임을 쓴다'
);
select is(
  (select (nickname, avatar, notify_hour, theme, onboarded_at is null)::text
   from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  '("면접 준비생",https://example.com/d.png,8,system,t)', '이름이 없으면 기본값으로 만든다'
);
select is(
  (select share_nickname from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  true, '공유 카드에는 처음엔 닉네임을 넣는다'
);

set local role anon;
select is((select count(*) from public.profiles), 0::bigint, '로그인 안 한 사람은 프로필을 못 읽는다');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select results_eq(
  'select id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  '로그인한 사람은 자기 프로필만 읽는다'
);
select is_empty(
  $$update public.profiles set nickname = '바꾼이름' returning id$$,
  '자기 프로필도 브라우저에서 직접 못 고친다'
);
select throws_ok(
  $$insert into public.profiles (id, nickname) values ('00000000-0000-0000-0000-00000000000e', '새사람')$$,
  '42501', null, '프로필을 직접 만들지 못한다'
);

select * from finish();
rollback;
