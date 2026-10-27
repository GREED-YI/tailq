-- 결과 공유 카드(#41, 08 설계 "공유 · 운영")
begin;
select plan(11);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000041a', '{"name": "테일러"}'),
  ('00000000-0000-0000-0000-00000000041b', '{"name": "비공개"}');
update public.profiles set share_nickname = false where id = '00000000-0000-0000-0000-00000000041b';

insert into public.projects (id, user_id, name, content) values
  ('00000000-0000-0000-0000-000000094100', '00000000-0000-0000-0000-00000000041a', '내 앱', repeat('README ', 10));
insert into public.questions (id, topic_id, level, prompt) values
  (94100, 'jpa', 'mid', '테스트 질문: 공유');
insert into public.questions (id, project_id, prompt) values
  (94101, '00000000-0000-0000-0000-000000094100', '테스트 질문: 프로젝트 공유');

insert into public.sessions (id, user_id, question_id, kind, pick, day, status) values
  ('00000000-0000-0000-0000-0000000941a1', '00000000-0000-0000-0000-00000000041a', 94100, 'daily', 'new', current_date, 'done'),
  ('00000000-0000-0000-0000-0000000941a2', '00000000-0000-0000-0000-00000000041a', 94101, 'project', null, current_date, 'done'),
  ('00000000-0000-0000-0000-0000000941a3', '00000000-0000-0000-0000-00000000041a', 94100, 'project', null, current_date, 'open'),
  ('00000000-0000-0000-0000-0000000941b1', '00000000-0000-0000-0000-00000000041b', 94100, 'daily', 'new', current_date, 'done');
insert into public.turns (session_id, idx, status, score, answered_at) values
  ('00000000-0000-0000-0000-0000000941a1', 0, 'graded', 72, now()),
  ('00000000-0000-0000-0000-0000000941a2', 0, 'graded', 55, now()),
  ('00000000-0000-0000-0000-0000000941a3', 0, 'answering', null, null),
  ('00000000-0000-0000-0000-0000000941b1', 0, 'graded', 90, now());

create temp table ids (name text primary key, id text);
insert into ids values
  ('a1', public.create_share('00000000-0000-0000-0000-00000000041a', '00000000-0000-0000-0000-0000000941a1', 12)),
  ('a2', public.create_share('00000000-0000-0000-0000-00000000041a', '00000000-0000-0000-0000-0000000941a2', -3)),
  ('b1', public.create_share('00000000-0000-0000-0000-00000000041b', '00000000-0000-0000-0000-0000000941b1', 1));

select matches((select id from ids where name = 'a1'), '^[0-9a-f]{12}$', '링크 id는 16진수 12자');
select results_eq(
  $$select nickname, topic_name, score::int, streak from public.shares where id = (select id from ids where name = 'a1')$$,
  $$values ('테일러'::text, 'JPA'::text, 72, 12)$$,
  '닉네임·주제·점수·꼬리잇기를 DB가 채운다'
);
select results_eq(
  $$select topic_name, streak from public.shares where id = (select id from ids where name = 'a2')$$,
  $$values ('내 프로젝트'::text, 0)$$,
  '프로젝트 질문은 "내 프로젝트", 음수 꼬리잇기는 0'
);
select is(
  (select nickname from public.shares where id = (select id from ids where name = 'b1')),
  null,
  '닉네임 공개를 끄면 닉네임을 뺀다'
);
select is(
  public.create_share('00000000-0000-0000-0000-00000000041a', '00000000-0000-0000-0000-0000000941a1', 99),
  (select id from ids where name = 'a1'),
  '다시 만들면 같은 카드를 돌려준다'
);

update public.profiles set share_nickname = false where id = '00000000-0000-0000-0000-00000000041a';
select public.create_share('00000000-0000-0000-0000-00000000041a', '00000000-0000-0000-0000-0000000941a1', 99);
select results_eq(
  $$select nickname, streak from public.shares where id = (select id from ids where name = 'a1')$$,
  $$values (null::text, 12)$$,
  '다시 만들 때 닉네임만 지금 설정을 따르고 꼬리잇기는 그대로'
);

select is(
  public.create_share('00000000-0000-0000-0000-00000000041b', '00000000-0000-0000-0000-0000000941a1', 1),
  null,
  '남의 세션은 공유할 수 없다'
);
select is(
  public.create_share('00000000-0000-0000-0000-00000000041a', '00000000-0000-0000-0000-0000000941a3', 1),
  null,
  '점수가 없는 세션은 공유할 수 없다'
);

-- 브라우저는 카드를 직접 읽지 못한다(공유 페이지는 서버가 id로만 읽는다)
set local role anon;
select is_empty('select 1 from public.shares', 'anon은 공유 카드를 읽지 못한다');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000041a", "role": "authenticated"}';
select is_empty('select 1 from public.shares', '로그인한 사람도 자기 카드를 직접 읽지 못한다');
reset role;

-- 탈퇴하면 그 사람의 카드가 지워진다
delete from auth.users where id = '00000000-0000-0000-0000-00000000041a';
select results_eq(
  $$select count(*) from public.shares where id in (select id from ids)$$,
  $$values (1::bigint)$$,
  '탈퇴하면 공유 카드도 지워지고 다른 사람 카드는 남는다'
);

select * from finish();
rollback;
