-- 웹 푸시(#37, 08 설계 "웹 푸시"): 구독 테이블, 알림 대상 고르기, 매시 호출
begin;
select plan(13);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000003a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000003b', '{"name": "비비"}'),
  ('00000000-0000-0000-0000-00000000003c', '{"name": "씨씨"}'),
  ('00000000-0000-0000-0000-00000000003d', '{"name": "디디"}'),
  ('00000000-0000-0000-0000-00000000003e', '{"name": "이이"}'),
  ('00000000-0000-0000-0000-00000000003f', '{"name": "에프"}');
insert into public.questions (id, topic_id, level, prompt, is_hidden) values
  (93701, 'jpa', 'mid', '테스트 질문: 푸시 1', false),
  (93702, 'jpa', 'mid', '테스트 질문: 푸시 2', true);

-- 기준 시각: 2026-10-27 23:30 UTC = 2026-10-28 08:30 KST(날짜와 시각 모두 UTC와 다르다)
-- a: 8시·구독 → 대상(복습 없음) / b: 8시·구독·복습일 된 질문 → 대상(복습)
-- c: 9시 / d: 8시·오늘 본 질문 제출 / e: 알림 끔 / f: 8시·구독 없음 → 모두 제외
update public.profiles set notify_on = true, notify_hour = 8
  where id in ('00000000-0000-0000-0000-00000000003a', '00000000-0000-0000-0000-00000000003b',
               '00000000-0000-0000-0000-00000000003d', '00000000-0000-0000-0000-00000000003f');
update public.profiles set notify_on = true, notify_hour = 9
  where id = '00000000-0000-0000-0000-00000000003c';
update public.profiles set notify_on = false, notify_hour = 8
  where id = '00000000-0000-0000-0000-00000000003e';

insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth_key) values
  ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-00000000003a', 'https://push.example.test/a', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000003b1', '00000000-0000-0000-0000-00000000003b', 'https://push.example.test/b', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-00000000003c', 'https://push.example.test/c', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-00000000003d', 'https://push.example.test/d', 'k', 'a'),
  ('00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-00000000003e', 'https://push.example.test/e', 'k', 'a');

-- a: 복습일이 내일인 질문과 오늘이지만 숨긴 질문은 "복습"으로 치지 않는다
insert into public.reviews (user_id, question_id, box, due_day) values
  ('00000000-0000-0000-0000-00000000003a', 93701, 1, '2026-10-29'),
  ('00000000-0000-0000-0000-00000000003a', 93702, 1, '2026-10-28'),
  ('00000000-0000-0000-0000-00000000003b', 93701, 2, '2026-10-28');

-- d: 오늘(KST) 본 질문을 제출했다. 어제 낸 a의 세션은 오늘과 상관없다
insert into public.sessions (id, user_id, question_id, kind, pick, day) values
  ('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-00000000003d', 93701, 'daily', 'new', '2026-10-28'),
  ('00000000-0000-0000-0000-0000000003a2', '00000000-0000-0000-0000-00000000003a', 93701, 'daily', 'new', '2026-10-27');
insert into public.turns (session_id, idx, status, answered_at, grading_started_at) values
  ('00000000-0000-0000-0000-0000000003d2', 0, 'grading', '2026-10-27 23:10+00', '2026-10-27 23:10+00'),
  ('00000000-0000-0000-0000-0000000003a2', 0, 'grading', '2026-10-27 01:00+00', '2026-10-27 01:00+00');

select results_eq(
  $$select user_id, review from public.pick_push_targets('2026-10-27 23:30+00') order by user_id$$,
  $$values ('00000000-0000-0000-0000-00000000003a'::uuid, false),
           ('00000000-0000-0000-0000-00000000003b'::uuid, true)$$,
  '이 시각(KST)을 고르고 구독이 있고 오늘 안 푼 사람만, 복습일이 된 질문 여부와 함께 고른다'
);
select results_eq(
  $$select id, last_notified_day from public.profiles
    where id::text like '00000000-0000-0000-0000-00000000003%' and last_notified_day is not null order by id$$,
  $$values ('00000000-0000-0000-0000-00000000003a'::uuid, '2026-10-28'::date),
           ('00000000-0000-0000-0000-00000000003b'::uuid, '2026-10-28'::date)$$,
  '고른 사람에게만 last_notified_day를 오늘(KST)로 적는다'
);
select is_empty(
  $$select * from public.pick_push_targets('2026-10-27 23:50+00')$$,
  '같은 날 다시 돌아도 두 번 고르지 않는다'
);
select results_eq(
  $$select user_id from public.pick_push_targets('2026-10-28 00:05+00')$$,
  $$values ('00000000-0000-0000-0000-00000000003c'::uuid)$$,
  '다음 시각(9시 KST)에는 9시를 고른 사람을 고른다'
);
select results_eq(
  $$select user_id from public.pick_push_targets('2026-10-28 23:30+00') order by user_id$$,
  $$values ('00000000-0000-0000-0000-00000000003a'::uuid),
           ('00000000-0000-0000-0000-00000000003b'::uuid),
           ('00000000-0000-0000-0000-00000000003d'::uuid)$$,
  '다음 날 같은 시각에는 다시 고른다(어제 푼 사람 포함)'
);

-- 구독: endpoint는 하나만, 형식 검사
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
    values ('00000000-0000-0000-0000-00000000003b', 'https://push.example.test/a', 'k', 'a')$$,
  '23505', null, '같은 endpoint는 한 줄만'
);
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
    values ('00000000-0000-0000-0000-00000000003b', 'http://push.example.test/x', 'k', 'a')$$,
  '23514', null, 'https 주소만 받는다'
);

-- 브라우저에서는 자기 구독만 읽고, 직접 쓰지 못한다
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000003a", "role": "authenticated"}';
select results_eq(
  'select id from public.push_subscriptions',
  $$values ('00000000-0000-0000-0000-0000000003a1'::uuid)$$,
  '자기 구독만 읽는다'
);
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
    values ('00000000-0000-0000-0000-00000000003a', 'https://push.example.test/z', 'k', 'a')$$,
  '42501', null, '브라우저에서 구독을 직접 넣을 수 없다'
);
delete from public.push_subscriptions;
reset role;
select is(
  (select count(*) from public.push_subscriptions where id = '00000000-0000-0000-0000-0000000003a1'),
  1::bigint,
  '브라우저에서 구독을 직접 지울 수 없다'
);

-- 탈퇴하면 구독도 지워진다
delete from auth.users where id = '00000000-0000-0000-0000-00000000003a';
select is(
  (select count(*) from public.push_subscriptions where user_id = '00000000-0000-0000-0000-00000000003a'),
  0::bigint,
  '탈퇴한 사용자의 구독이 지워진다(cascade)'
);

-- 매시 호출: vault에 주소·비밀값이 없으면 아무것도 보내지 않고, 있으면 비밀 헤더를 붙여 요청을 넣는다
create temp table queued as select count(*) as n from net.http_request_queue;
select public.request_push_cron();
select is(
  (select count(*) from net.http_request_queue),
  (select n from queued),
  'vault에 값이 없으면 부르지 않는다'
);
select vault.create_secret('https://app.example.test/api/cron/push', 'push_cron_url');
select vault.create_secret('test-cron-secret', 'cron_secret');
select public.request_push_cron();
select results_eq(
  $$select url, headers ->> 'authorization' from net.http_request_queue
    where url = 'https://app.example.test/api/cron/push'$$,
  $$values ('https://app.example.test/api/cron/push', 'Bearer test-cron-secret')$$,
  'vault의 주소로 비밀 헤더를 붙여 부른다'
);

select * from finish();
rollback;
