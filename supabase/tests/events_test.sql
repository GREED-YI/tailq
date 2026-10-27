-- 지표 이벤트(#44): 입구 제한, 탈퇴 삭제, 90일 보관, 성공 지표 계산
begin;
select plan(13);

-- 입구 제한: 허용 목록 밖의 이름, 객체가 아닌 props, 1KB 넘는 props는 받지 않는다
select throws_ok(
  $$select public.record_event('page_view', null, null, '{}')$$,
  '23514', null, '허용 목록에 없는 이름은 받지 않는다'
);
select throws_ok(
  $$select public.record_event('rating', null, null, '[1]')$$,
  '23514', null, 'props는 객체만'
);
select throws_ok(
  $$select public.record_event('rating', null, null, jsonb_build_object('x', repeat('a', 1100)))$$,
  '23514', null, 'props는 1KB까지'
);

-- 같은 브라우저는 24시간에 200건까지만
insert into public.events (name, anon_id)
select 'first_visit', 'aaaaaaaa-0000-0000-0000-000000000099' from generate_series(1, 199);
select public.record_event('notification_click', null, 'aaaaaaaa-0000-0000-0000-000000000099', '{}');
select public.record_event('notification_click', null, 'aaaaaaaa-0000-0000-0000-000000000099', '{}');
select is(
  (select count(*) from public.events where anon_id = 'aaaaaaaa-0000-0000-0000-000000000099'),
  200::bigint,
  '같은 anon_id의 201번째 이벤트는 버린다'
);

-- 탈퇴: 그 사용자의 이벤트와 그 사용자가 쓴 브라우저의 로그인 전 이벤트를 지운다
insert into public.events (name, user_id, anon_id) values
  ('first_visit', null, 'aaaaaaaa-0000-0000-0000-00000000000d'),
  ('session_start', '00000000-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-00000000000d'),
  ('session_start', '00000000-0000-0000-0000-00000000000d', null),
  ('first_visit', null, 'aaaaaaaa-0000-0000-0000-00000000000e'),
  ('session_start', '00000000-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000e');
select public.delete_user_events('00000000-0000-0000-0000-00000000000d');
select is(
  (select count(*) from public.events
   where user_id = '00000000-0000-0000-0000-00000000000d'
      or anon_id = 'aaaaaaaa-0000-0000-0000-00000000000d'),
  0::bigint,
  '탈퇴한 사용자의 이벤트와 같은 브라우저의 로그인 전 이벤트가 지워진다'
);
select is(
  (select count(*) from public.events where anon_id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
  2::bigint,
  '다른 사람의 이벤트는 그대로'
);

-- 90일 보관
insert into public.events (name, anon_id, created_at) values
  ('first_visit', 'aaaaaaaa-0000-0000-0000-0000000000f1', now() - interval '91 days'),
  ('first_visit', 'aaaaaaaa-0000-0000-0000-0000000000f2', now() - interval '89 days');
select public.purge_old_events();
select results_eq(
  $$select anon_id from public.events where anon_id in
      ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-0000000000f2')$$,
  $$values ('aaaaaaaa-0000-0000-0000-0000000000f2'::uuid)$$,
  '90일 지난 이벤트만 지운다'
);
select is(
  (select count(*) from cron.job where jobname = 'purge-old-events' and schedule = '0 19 * * *'),
  1::bigint,
  '매일 4시(KST)에 정리한다'
);

-- 브라우저는 읽지 못한다
select ok(
  not has_table_privilege('authenticated', 'public.metrics_weekly', 'select')
  and not has_table_privilege('anon', 'public.metrics_weekly', 'select'),
  '지표 뷰는 서버만 읽는다'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'events'),
  0::bigint,
  'events에는 정책이 없다(RLS로 브라우저 차단)'
);

-- 성공 지표 계산. 2020-01-06(월) 주, 시각은 KST
-- 첫 방문 A·B·C. A는 그 주에, C는 2주 뒤에 답했고 B는 답하지 않았다 → 3명 중 2명
-- 답변: t1(다시 채점으로 두 번), t2 → 2개. C의 t3는 2020-01-20 주
-- 가입: U1(월요일 01시 KST = 일요일 UTC), U2. U1은 나흘 뒤 다시 왔고 U2는 가입 당일과 8일 뒤에만 → 2명 중 1명
-- 평가: t1은 👎 뒤 👍(마지막만 센다), t2는 👎 → 2개 중 👍 1개
insert into public.events (name, user_id, anon_id, props, created_at) values
  ('first_visit', null, 'bbbbbbbb-0000-0000-0000-00000000000a', '{}', '2020-01-06 00:30+09'),
  ('signup', '00000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-00000000000a', '{}', '2020-01-06 01:00+09'),
  ('answer_submit', '00000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-00000000000a',
    '{"turn_id": "t1", "kind": "daily", "dont_know": false}', '2020-01-06 01:10+09'),
  ('answer_submit', '00000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-00000000000a',
    '{"turn_id": "t1", "kind": "daily", "dont_know": false}', '2020-01-06 01:12+09'),
  ('rating', '00000000-0000-0000-0000-0000000000a1', null, '{"turn_id": "t1", "rating": -1}', '2020-01-06 01:13+09'),
  ('rating', '00000000-0000-0000-0000-0000000000a1', null, '{"turn_id": "t1", "rating": 1}', '2020-01-06 01:14+09'),
  ('session_start', '00000000-0000-0000-0000-0000000000a1', null, '{"kind": "daily"}', '2020-01-10 09:00+09'),
  ('first_visit', null, 'bbbbbbbb-0000-0000-0000-00000000000b', '{}', '2020-01-07 12:00+09'),
  ('signup', '00000000-0000-0000-0000-0000000000a2', null, '{}', '2020-01-07 12:00+09'),
  ('answer_submit', '00000000-0000-0000-0000-0000000000a2', null,
    '{"turn_id": "t2", "kind": "daily", "dont_know": true}', '2020-01-07 12:05+09'),
  ('rating', '00000000-0000-0000-0000-0000000000a2', null, '{"turn_id": "t2", "rating": -1}', '2020-01-07 12:06+09'),
  ('session_start', '00000000-0000-0000-0000-0000000000a2', null, '{"kind": "daily"}', '2020-01-15 12:00+09'),
  ('first_visit', null, 'bbbbbbbb-0000-0000-0000-00000000000c', '{}', '2020-01-08 20:00+09'),
  ('answer_submit', '00000000-0000-0000-0000-0000000000a3', 'bbbbbbbb-0000-0000-0000-00000000000c',
    '{"turn_id": "t3", "kind": "trial", "dont_know": false}', '2020-01-20 20:00+09');

select results_eq(
  $$select answers, first_visitors, first_visitors_answered, d7_cohort, d7_returned, ratings, thumbs_up
    from public.metrics_weekly where week = '2020-01-06'$$,
  $$values (2::bigint, 3::bigint, 2::bigint, 2::bigint, 1::bigint, 2::bigint, 1::bigint)$$,
  '주간 답변·첫 답변 전환·D7·👍 수를 센다'
);
select results_eq(
  $$select first_answer_rate, d7_rate, thumbs_up_rate from public.metrics_weekly where week = '2020-01-06'$$,
  $$values (0.667::numeric, 0.500::numeric, 0.500::numeric)$$,
  '비율은 소수 셋째 자리까지'
);
select results_eq(
  $$select answers, first_visitors from public.metrics_weekly where week = '2020-01-20'$$,
  $$values (1::bigint, 0::bigint)$$,
  '다음 주에 한 답변은 그 주의 답변 수로 센다'
);

select * from finish();
rollback;
