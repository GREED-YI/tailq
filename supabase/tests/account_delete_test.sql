-- 탈퇴(#42, 08 설계 "탈퇴"): auth.users 행을 지우면 그 사용자의 기록이 모두 지워진다
begin;
select plan(3);

-- 앞으로 생길 테이블도 auth.users를 가리키면 cascade(지움)나 set null(비용 합계처럼 개인 내용 없는 행)이어야 한다
select is_empty(
  $$select conrelid::regclass::text
    from pg_constraint
    where contype = 'f' and confrelid = 'auth.users'::regclass
      and connamespace = 'public'::regnamespace
      and confdeltype not in ('c', 'n')$$,
  'auth.users를 가리키는 외래키는 모두 cascade 또는 set null'
);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"name": "비비"}');
insert into public.questions (id, topic_id, level, prompt) values
  (92790, 'jpa', 'mid', '테스트 질문: 탈퇴');

select public.start_daily_session('00000000-0000-0000-0000-00000000000a', 92790, 'new');
select public.start_daily_session('00000000-0000-0000-0000-00000000000b', 92790, 'new');
select public.set_bookmark('00000000-0000-0000-0000-00000000000a', 92790, true);
insert into public.reviews (user_id, question_id, box, due_day) values
  ('00000000-0000-0000-0000-00000000000a', 92790, 1, current_date);

create temp table gone as
  select id from public.sessions where user_id = '00000000-0000-0000-0000-00000000000a';

delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select
     (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a')
   + (select count(*) from public.sessions where user_id = '00000000-0000-0000-0000-00000000000a')
   + (select count(*) from public.turns where session_id in (select id from gone))
   + (select count(*) from public.reviews where user_id = '00000000-0000-0000-0000-00000000000a')
   + (select count(*) from public.bookmarks where user_id = '00000000-0000-0000-0000-00000000000a')),
  0::bigint,
  '탈퇴한 사용자의 프로필·세션·답변·복습·북마크가 모두 지워진다'
);
select is(
  (select count(*) from public.sessions where user_id = '00000000-0000-0000-0000-00000000000b'),
  1::bigint,
  '다른 사용자의 기록은 그대로'
);

select * from finish();
rollback;
