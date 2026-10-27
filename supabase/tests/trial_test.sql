-- 로그인 없는 체험과 이어받기(#40, 08 설계 2장 "체험과 이어받기")
begin;
select plan(22);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000094001', '{"name": "체험가입"}'),
  ('00000000-0000-0000-0000-000000094002', '{"name": "기존회원"}');

insert into public.questions (id, topic_id, level, prompt, trial_field) values
  (94001, 'jpa', 'mid', '테스트 체험 질문: 백엔드', 'backend'),
  (94002, 'network', 'basic', '테스트 체험 질문: CS', 'cs');

create function pg_temp.main(score int) returns jsonb language sql as $$
  select jsonb_build_object(
    'score', score,
    'feedback', jsonb_build_object('summary', '한 줄 평', 'good', '[]'::jsonb, 'improve', '["보완"]'::jsonb),
    'follow_up', jsonb_build_object('question', '꼬리질문 1?', 'expected_answer', '기대 답안 1'))
$$;
create function pg_temp.follow() returns jsonb language sql as $$
  select jsonb_build_object(
    'verdict', 'good',
    'feedback', jsonb_build_object('summary', '한 줄 피드백'),
    'follow_up', jsonb_build_object('question', '꼬리질문 2?', 'expected_answer', '기대 2'))
$$;
create function pg_temp.turn(token text, i int) returns uuid language sql as $$
  select t.id from public.turns t join public.sessions s on s.id = t.session_id
  where s.trial_token = token and t.idx = i
$$;

-- 시작
create temp table a as select * from public.start_trial('tok-a', 'ip-1', 'backend');
select is(
  (select (a.kind, a.user_id, a.trial_token, a.ip_hash, a.status, q.trial_field)::text
   from a join public.questions q on q.id = a.question_id),
  '(trial,,tok-a,ip-1,open,backend)',
  '체험 세션은 사용자 없이 토큰·IP 해시와 그 분야의 샘플 질문으로 만든다'
);
select is(
  (select count(*) from public.turns where session_id = (select id from a) and idx = 0 and status = 'answering'),
  1::bigint,
  '본 질문 턴을 함께 만든다'
);
select is(
  (select id from public.start_trial('tok-a', 'ip-1', 'cs')),
  (select id from a),
  '같은 브라우저의 체험이 열려 있으면 그것을 돌려준다'
);
select throws_ok(
  $$select public.start_trial('tok-x', 'ip-1', 'design')$$,
  'VALIDATION',
  '분야는 cs·backend·frontend만'
);

-- 답변 제출 소유 확인
select throws_ok(
  format($$select public.submit_answer(%L, p_answer => %L, p_trial_token => 'tok-b')$$, pg_temp.turn('tok-a', 0), repeat('가', 40)),
  'NOT_OWNER',
  '다른 브라우저의 토큰으로는 답할 수 없다'
);
select throws_ok(
  format($$select public.submit_answer(%L, %L, %L, false)$$, pg_temp.turn('tok-a', 0), '00000000-0000-0000-0000-000000094002', repeat('가', 40)),
  'NOT_OWNER',
  '로그인 사용자도 남의 체험에는 답할 수 없다'
);
select is(
  (public.submit_answer(pg_temp.turn('tok-a', 0), p_answer => repeat('가', 40), p_trial_token => 'tok-a')).status,
  'grading',
  '자기 토큰이면 채점으로 넘어간다'
);

-- 채점 저장: 복습 칸 없이 꼬리질문 1개까지
select is(
  (public.save_grading(pg_temp.turn('tok-a', 0), pg_temp.main(80)) ->> 'session_status'),
  'open',
  '본 질문을 채점하면 꼬리질문 1로 이어간다'
);
select is(
  (select count(*) from public.reviews r join a on r.question_id = a.question_id),
  0::bigint,
  '체험은 복습 칸을 만들지 않는다'
);
select public.submit_answer(pg_temp.turn('tok-a', 1), p_answer => repeat('나', 40), p_trial_token => 'tok-a');
select is(
  (public.save_grading(pg_temp.turn('tok-a', 1), pg_temp.follow()) ->> 'session_status'),
  'done',
  '꼬리질문 1을 판정하면 다음 꼬리질문 없이 끝난다'
);
select is(
  (select count(*) from public.turns where session_id = (select id from a)),
  2::bigint,
  '체험 턴은 본 질문 + 꼬리질문 1개'
);
select throws_ok(
  $$select public.start_trial('tok-a', 'ip-1', 'backend')$$,
  'TRIAL_LIMIT',
  '같은 브라우저는 하루 1번'
);

-- 이어받기
select is(
  public.adopt_trial('00000000-0000-0000-0000-000000094001', 'tok-a'),
  (select id from a),
  '처음 가입한 사용자는 오늘 체험을 이어받는다'
);
select is(
  (select (s.user_id, s.kind, s.pick, s.trial_token, s.ip_hash, s.status)::text from public.sessions s where s.id = (select id from a)),
  '(00000000-0000-0000-0000-000000094001,daily,new,,,done)',
  '오늘의 질문 세션이 되고 토큰·IP 해시를 지운다'
);
select is(
  (select box from public.reviews where user_id = '00000000-0000-0000-0000-000000094001' and question_id = (select question_id from a)),
  2::smallint,
  '본 질문 결과로 복습 칸을 만든다(잘 답함은 2칸)'
);

-- 꼬리질문 중에 이어받으면 닫고 남은 턴은 skipped. 이미 기록이 있는 사용자는 이어받지 않는다
create temp table b as select * from public.start_trial('tok-b', 'ip-2', 'cs');
select public.submit_answer(pg_temp.turn('tok-b', 0), p_answer => repeat('다', 40), p_trial_token => 'tok-b');
select public.save_grading(pg_temp.turn('tok-b', 0), pg_temp.main(50));
insert into public.sessions (user_id, question_id, kind, day)
values ('00000000-0000-0000-0000-000000094002', 94002, 'project', (now() at time zone 'Asia/Seoul')::date);
select is(
  public.adopt_trial('00000000-0000-0000-0000-000000094002', 'tok-b'),
  null,
  '이미 기록이 있는 사용자는 이어받지 않는다'
);
delete from public.sessions where user_id = '00000000-0000-0000-0000-000000094002';
select isnt(public.adopt_trial('00000000-0000-0000-0000-000000094002', 'tok-b'), null, '기록이 없으면 이어받는다');
select is(
  (select string_agg(idx || ':' || status, ',' order by idx) from public.turns where session_id = (select id from b)),
  '0:graded,1:skipped',
  '꼬리질문 중이었으면 남은 턴은 skipped로 닫는다'
);

-- 같은 IP는 하루 20번
select public.start_trial('ip3-' || n, 'ip-3', 'backend') from generate_series(1, 20) n;
select throws_ok(
  $$select public.start_trial('ip3-21', 'ip-3', 'backend')$$,
  'TRIAL_LIMIT',
  '같은 IP는 하루 20번까지'
);

-- 새벽 정리: 지난 날의 이어받지 않은 체험만 지운다
update public.sessions set day = day - 1 where trial_token = 'ip3-1';
select is(public.cleanup_trials(), 1, '지난 날 체험을 지운다');
select is(
  (select count(*) from public.sessions where trial_token like 'ip3-%'),
  19::bigint,
  '오늘 체험과 이어받은 세션은 남긴다'
);

select is(
  (select count(*) from cron.job where jobname = 'cleanup-trials' and schedule = '0 19 * * *'),
  1::bigint,
  '체험 정리는 매일 4시(KST)에 돈다'
);

select * from finish();
rollback;
