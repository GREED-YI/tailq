-- 하루 사용 상한과 월 예산(#43, 04 기능 명세 12장, 08 설계 "하루 사용 한도와 월 예산")
begin;
select plan(35);

-- 공유 DB에 쌓인 기록이 예산 계산에 섞이지 않게 비우고 시작한다(트랜잭션이라 되돌려진다)
delete from public.ai_usage;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000043a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000043b', '{"name": "비비"}'),
  ('00000000-0000-0000-0000-00000000043c', '{"name": "씨씨"}');

insert into public.questions (id, topic_id, level, prompt, trial_field) values
  (94399, 'jpa', 'mid', '테스트 질문: 영속성 컨텍스트', null),
  (94398, 'jpa', 'mid', '테스트 체험 질문', 'backend');

create temp table ids (name text primary key, id uuid);

create function pg_temp.five() returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'prompt', '테스트 프로젝트 질문 ' || n,
    'rubric', jsonb_build_object('keywords', jsonb_build_array('무상태'), 'criteria', jsonb_build_array('이유')),
    'model_answer', '예시 답안 ' || n))
  from generate_series(1, 5) n
$$;

create function pg_temp.used(p_cost numeric) returns jsonb language sql as $$
  select jsonb_build_object('status', 'used', 'model', 'claude-sonnet-5-5', 'input_tokens', 500,
    'output_tokens', 600, 'cache_read_tokens', 3100, 'cache_write_tokens', 0, 'cost_usd', p_cost, 'latency_ms', 4200)
$$;

-- 지난달 비용은 이번 달 예산에 들어가지 않는다
insert into public.ai_usage (purpose, status, cost_usd, day)
values ('grade', 'used', 100, (date_trunc('month', (now() at time zone 'Asia/Seoul')::date) - interval '1 day')::date);
select is(
  public.ai_quota('00000000-0000-0000-0000-00000000043a', 20) ->> 'budget', 'ok',
  '지난달 비용은 이번 달 예산에 넣지 않는다'
);

-- 프로젝트 질문 생성: 하루 1회, 등록할 때 몫을 예약한다
insert into ids select 'p1', (public.create_project('00000000-0000-0000-0000-00000000043a', '혜자', repeat('README ', 10), 20)).id;
select is(
  (select row(purpose, quota, status, user_id::text)::text from public.ai_usage where ref_id = (select id from ids where name = 'p1')),
  row('project_gen', 'project_gen', 'reserved', '00000000-0000-0000-0000-00000000043a')::text,
  '등록하면 질문 생성 몫을 reserved로 예약한다'
);
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000043a', '두 번째', repeat('README ', 10), 20)$$,
  'LIMIT_EXCEEDED', '같은 날 두 번째 질문 생성은 한도로 막는다'
);
select is(
  (select count(*) from public.projects where user_id = '00000000-0000-0000-0000-00000000043a'),
  1::bigint, '한도로 막힌 등록은 프로젝트를 만들지 않는다'
);

-- 생성 호출이 예약한 행을 used로 바꾼다(새 행을 만들지 않는다)
select public.record_ai_usage('00000000-0000-0000-0000-00000000043a', 'project_gen', (select id from ids where name = 'p1'), pg_temp.used(0.03));
select is(
  (select row(count(*), min(status), sum(cost_usd), min(cache_read_tokens))::text from public.ai_usage where ref_id = (select id from ids where name = 'p1')),
  row(1, 'used', 0.030000, 3100)::text,
  '예약한 몫을 used·토큰·비용으로 바꾼다'
);
select is(
  (public.ai_quota('00000000-0000-0000-0000-00000000043a', 20) ->> 'gens_left')::int, 0,
  '쓴 몫도 그날 한도에 남는다'
);
select throws_ok(
  $$select public.record_ai_usage('00000000-0000-0000-0000-00000000043a', 'grade', null, '{"status": "reserved"}')$$,
  'VALIDATION', '기록은 used·failed만 받는다'
);
select public.save_project_questions((select id from ids where name = 'p1'), pg_temp.five(), null);
create temp table pq as
  select id, row_number() over (order by id) as n from public.questions
  where project_id = (select id from ids where name = 'p1');

-- 프로젝트 질문 연습: 하루 3세션, 새로 만들 때 본 질문 채점 몫을 예약한다
insert into ids select 's1', (public.start_project_session('00000000-0000-0000-0000-00000000043a', (select id from pq where n = 1)::int, 20)).id;
insert into ids select 's2', (public.start_project_session('00000000-0000-0000-0000-00000000043a', (select id from pq where n = 2)::int, 20)).id;
insert into ids select 's3', (public.start_project_session('00000000-0000-0000-0000-00000000043a', (select id from pq where n = 3)::int, 20)).id;
select is(
  (select count(*) from public.ai_usage where quota = 'project_session' and status = 'reserved'
     and ref_id in (select id from ids where name like 's%')),
  3::bigint, '세션마다 본 질문 채점 몫을 하나씩 예약한다'
);
select is(
  (select grade_model from public.sessions where id = (select id from ids where name = 's1')),
  'sonnet', '예산 80% 전에는 본 질문을 Sonnet으로 채점한다'
);
select throws_ok(
  format($$select public.start_project_session('00000000-0000-0000-0000-00000000043a', %s, 20)$$, (select id from pq where n = 4)),
  'LIMIT_EXCEEDED', '네 번째 새 세션은 시작 전에 한도로 막는다'
);
select is(
  (public.start_project_session('00000000-0000-0000-0000-00000000043a', (select id from pq where n = 1)::int, 20)).id,
  (select id from ids where name = 's1'),
  '한도를 다 써도 시작한 세션은 이어 할 수 있다'
);
select is(
  (select count(*) from public.sessions where user_id = '00000000-0000-0000-0000-00000000043a' and kind = 'project'),
  3::bigint, '한도로 막힌 시작은 세션을 만들지 않는다'
);

-- 본 질문 채점이 예약을 쓰고, 꼬리질문과 다시 채점은 새 행으로 남는다
select public.record_ai_usage('00000000-0000-0000-0000-00000000043a', 'grade', (select id from ids where name = 's2'),
  jsonb_build_object('status', 'failed', 'error_code', 'timeout', 'latency_ms', 15000));
select public.record_ai_usage('00000000-0000-0000-0000-00000000043a', 'grade', (select id from ids where name = 's2'), pg_temp.used(0.008));
select public.record_ai_usage('00000000-0000-0000-0000-00000000043a', 'follow_up', (select id from ids where name = 's2'), pg_temp.used(0.0003));
select is(
  (select string_agg(purpose || ':' || status || ':' || coalesce(quota, '-') || ':' || coalesce(error_code, '-'), ',' order by id)
   from public.ai_usage where ref_id = (select id from ids where name = 's2')),
  'grade:failed:project_session:timeout,grade:used:-:-,follow_up:used:-:-',
  '실패한 채점이 예약을 쓰고, 다시 채점·꼬리질문은 한도 몫 없이 새 행'
);
select is(
  (public.ai_quota('00000000-0000-0000-0000-00000000043a', 20) ->> 'sessions_left')::int, 0,
  '실패한 세션도 그날 몫을 쓴다'
);

-- AI를 쓰지 않고 끝난 세션("모르겠어요")은 몫을 돌려준다
select public.release_ai_usage((select id from ids where name = 's3'));
select is(
  (select status from public.ai_usage where ref_id = (select id from ids where name = 's3')),
  'released', '돌려준 몫은 released'
);
select is(
  (public.ai_quota('00000000-0000-0000-0000-00000000043a', 20) ->> 'sessions_left')::int, 1,
  '돌려준 몫만큼 다시 시작할 수 있다'
);
select public.release_ai_usage((select id from ids where name = 's2'));
select is(
  (select count(*) from public.ai_usage where ref_id = (select id from ids where name = 's2') and status = 'released'),
  0::bigint, '이미 쓴 몫은 돌려주지 않는다'
);
select is(
  (public.ai_quota('00000000-0000-0000-0000-00000000043b', 20) ->> 'sessions_left')::int, 3,
  '한도는 사용자마다 따로 센다'
);

-- 오늘의 질문은 개인 한도와 상관없다
select lives_ok(
  $$insert into ids select 'd1', (public.start_daily_session('00000000-0000-0000-0000-00000000043a', 94399, 'new', 20)).id$$,
  '프로젝트 한도를 다 써도 오늘의 질문은 시작한다'
);
select is(
  (select count(*) from public.ai_usage where ref_id = (select id from ids where name = 'd1')),
  0::bigint, '오늘의 질문은 한도 몫을 예약하지 않는다'
);

-- 체험: 개인 한도는 없고 월 예산만 본다. 체험 호출은 사용자 없이 trial로 남아 예산에 들어간다
select is(
  (public.start_trial('tok-43a', 'ip-43', 'backend', 20)).grade_model,
  'sonnet', '예산 80% 전의 체험은 Sonnet으로 채점한다'
);
select public.record_ai_usage(null, 'trial', (select id from public.sessions where trial_token = 'tok-43a'), pg_temp.used(0.5));
select is(
  (select row(user_id, quota, status)::text from public.ai_usage where purpose = 'trial'),
  row(null::uuid, null::text, 'used')::text,
  '체험 호출은 사용자·한도 몫 없이 trial로 남는다'
);

-- 예산 80%를 넘으면 새로 시작하는 세션만 Haiku로
insert into public.ai_usage (purpose, status, cost_usd) values ('grade', 'used', 15.6);
select is(public.ai_quota(null, 20) ->> 'budget', 'downgrade', '예산 80%를 넘으면 downgrade');
select is(
  (public.start_daily_session('00000000-0000-0000-0000-00000000043b', 94399, 'new', 20)).grade_model,
  'haiku', '80%를 넘은 뒤 시작한 세션은 본 질문을 Haiku로 채점한다'
);
select is(
  (select grade_model from public.sessions where id = (select id from ids where name = 's1')),
  'sonnet', '이미 시작한 세션의 모델은 바뀌지 않는다'
);
select is(
  (public.start_trial('tok-43b', 'ip-43', 'backend', 20)).grade_model,
  'haiku', '80%를 넘은 뒤 시작한 체험도 Haiku로 채점한다'
);

-- 예산에 닿으면 모든 AI 기능을 시작 전에 막고, 시작한 세션은 끝까지
insert into public.ai_usage (purpose, status, cost_usd) values ('trial', 'used', 4.0);
select throws_ok(
  $$select public.start_trial('tok-43c', 'ip-43', 'backend', 20)$$,
  'BUDGET_EXCEEDED', '예산에 닿으면 체험도 시작 전에 막는다'
);
select is(
  (select count(*) from public.sessions where trial_token = 'tok-43c'),
  0::bigint, '막힌 체험은 세션을 만들지 않는다'
);
select is(
  (public.start_trial('tok-43b', 'ip-43', 'backend', 20)).id,
  (select id from public.sessions where trial_token = 'tok-43b'),
  '이미 시작한 체험은 예산에 닿아도 이어 한다'
);
select throws_ok(
  $$select public.start_daily_session('00000000-0000-0000-0000-00000000043c', 94399, 'new', 20)$$,
  'BUDGET_EXCEEDED', '예산에 닿으면 오늘의 질문도 새로 시작하지 않는다'
);
select is(
  (public.start_daily_session('00000000-0000-0000-0000-00000000043a', 94399, 'new', 20)).id,
  (select id from ids where name = 'd1'),
  '이미 시작한 오늘의 세션은 예산에 닿아도 그대로'
);
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000043c', '셋', repeat('README ', 10), 20)$$,
  'BUDGET_EXCEEDED', '예산에 닿으면 프로젝트 질문 생성도 막는다'
);
update public.projects set status = 'failed' where id = (select id from ids where name = 'p1');
select throws_ok(
  $$select public.restart_project_generation('00000000-0000-0000-0000-00000000043a', (select id from ids where name = 'p1'), 20)$$,
  'BUDGET_EXCEEDED', '예산에 닿으면 다시 생성도 막는다'
);
select lives_ok(
  $$select public.record_ai_usage('00000000-0000-0000-0000-00000000043a', 'follow_up', (select id from ids where name = 's1'), pg_temp.used(0.0004))$$,
  '시작한 세션의 호출 기록은 예산과 상관없이 남는다'
);

-- 탈퇴하면 user_id만 비우고 비용 기록은 남긴다
delete from auth.users where id = '00000000-0000-0000-0000-00000000043a';
select is(
  (select count(*) from public.ai_usage where ref_id in (select id from ids) and user_id is null),
  (select count(*) from public.ai_usage where ref_id in (select id from ids)),
  '탈퇴한 사용자의 비용 기록은 user_id 없이 남는다'
);

select * from finish();
rollback;
