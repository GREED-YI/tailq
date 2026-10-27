-- 내 프로젝트 기반 질문(#39, 04 기능 명세 9번)
begin;
select plan(25);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000039a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000039b', '{"name": "비비"}');

insert into public.questions (id, topic_id, level, prompt) values
  (93901, 'jpa', 'mid', '테스트 질문: 영속성 컨텍스트');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- 5개를 만드는 생성 결과(서버가 검증한 모양)
create function pg_temp.five() returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'prompt', '테스트 프로젝트 질문 ' || n,
    'rubric', jsonb_build_object('keywords', jsonb_build_array('무상태'), 'criteria', jsonb_build_array('이유를 말한다')),
    'model_answer', '예시 답안 ' || n))
  from generate_series(1, 5) n
$$;

-- 사용자당 3개까지
insert into ids select 'p1', (public.create_project('00000000-0000-0000-0000-00000000039a', '혜자', repeat('README ', 10))).id;
insert into ids select 'p2', (public.create_project('00000000-0000-0000-0000-00000000039a', '두 번째', repeat('README ', 10))).id;
insert into ids select 'p3', (public.create_project('00000000-0000-0000-0000-00000000039a', '세 번째', repeat('README ', 10))).id;
select is(
  (select status from public.projects where id = (select id from ids where name = 'p1')),
  'generating',
  '등록하면 generating으로 저장한다'
);
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000039a', '네 번째', repeat('README ', 10))$$,
  'PROJECT_LIMIT', '4번째 프로젝트는 등록하지 못한다'
);
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000039b', '남의 것', repeat('README ', 10))$$,
  '3개 제한은 사용자마다 따로 센다'
);
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000039b', '짧음', '짧은 설명')$$,
  '23514', null, 'README가 30자보다 짧으면 저장하지 않는다'
);

-- 생성 결과 저장: 질문 5개 + 정답지, ready
select public.save_project_questions((select id from ids where name = 'p1'), pg_temp.five(), null);
select is(
  (select status from public.projects where id = (select id from ids where name = 'p1')),
  'ready',
  '질문을 저장하면 ready'
);
select is(
  (select count(*) from public.questions q join public.question_keys k on k.question_id = q.id
   where q.project_id = (select id from ids where name = 'p1')
     and q.topic_id is null and q.level is null and k.links is null
     and k.rubric = '{"keywords": ["무상태"], "criteria": ["이유를 말한다"]}'),
  5::bigint,
  '질문 5개와 채점 기준을 저장한다(세부 주제·난이도·링크 없음)'
);
select throws_ok(
  $$select public.save_project_questions((select id from ids where name = 'p1'), pg_temp.five(), null)$$,
  'NOT_GENERATING', '이미 저장한 프로젝트에 다시 저장하지 않는다'
);
select throws_ok(
  $$select public.save_project_questions((select id from ids where name = 'p2'), pg_temp.five() - 0, null)$$,
  'VALIDATION', '질문이 5개가 아니면 저장하지 않는다'
);
select is(
  (select count(*) from public.bank_questions where id in
    (select id from public.questions where project_id = (select id from ids where name = 'p1'))),
  0::bigint,
  '프로젝트 질문은 출제 후보(bank_questions)에 들어가지 않는다'
);
select throws_ok(
  $$insert into public.questions (prompt) values ('세부 주제 없는 은행 질문')$$,
  '23514', null, '은행 질문은 세부 주제·난이도가 있어야 한다'
);

-- 실패와 다시 생성
select public.save_project_questions((select id from ids where name = 'p2'), null, 'timeout');
select results_eq(
  $$select status, error_code from public.projects where id = (select id from ids where name = 'p2')$$,
  $$values ('failed', 'timeout')$$,
  '생성이 실패하면 failed와 에러 코드'
);
select throws_ok(
  $$select public.restart_project_generation('00000000-0000-0000-0000-00000000039b', (select id from ids where name = 'p2'))$$,
  'NOT_OWNER', '남의 프로젝트는 다시 생성하지 못한다'
);
select is(
  (public.restart_project_generation('00000000-0000-0000-0000-00000000039a', (select id from ids where name = 'p2'))).status,
  'generating',
  '실패한 프로젝트는 다시 생성할 수 있다'
);
select throws_ok(
  $$select public.restart_project_generation('00000000-0000-0000-0000-00000000039a', (select id from ids where name = 'p1'))$$,
  'NOT_FAILED', '실패하지 않은 프로젝트는 다시 생성하지 않는다'
);

-- 연습 세션: 내 프로젝트 질문만, 열린 세션은 이어간다
create temp table pq as
  select id from public.questions where project_id = (select id from ids where name = 'p1') order by id;
insert into ids select 's1', (public.start_project_session('00000000-0000-0000-0000-00000000039a', (select min(id) from pq))).id;
select results_eq(
  $$select s.kind, s.pick, s.status, (select count(*) from public.turns t where t.session_id = s.id and t.idx = 0)
    from public.sessions s where s.id = (select id from ids where name = 's1')$$,
  $$values ('project', null::text, 'open', 1::bigint)$$,
  '프로젝트 질문 세션과 본 질문 턴을 만든다'
);
select is(
  (public.start_project_session('00000000-0000-0000-0000-00000000039a', (select min(id) from pq))).id,
  (select id from ids where name = 's1'),
  '같은 질문의 열린 세션이 있으면 그것을 돌려준다'
);
select throws_ok(
  $$select public.start_project_session('00000000-0000-0000-0000-00000000039b', (select min(id) from pq))$$,
  'NOT_OWNER', '남의 프로젝트 질문으로는 세션을 열지 못한다'
);
select throws_ok(
  $$select public.start_project_session('00000000-0000-0000-0000-00000000039a', 93901)$$,
  'NOT_FOUND', '은행 질문은 프로젝트 세션으로 열지 않는다'
);

-- 브라우저에서는 자기 프로젝트와 그 질문만 읽고, 직접 쓰지 못한다
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000039b", "role": "authenticated"}';
select is(
  (select count(*) from public.questions where project_id is not null),
  0::bigint,
  '남의 프로젝트 질문은 읽지 못한다'
);
select results_eq(
  'select name from public.projects',
  $$values ('남의 것')$$,
  '자기 프로젝트만 읽는다'
);
select throws_ok(
  $$insert into public.projects (user_id, name, content) values ('00000000-0000-0000-0000-00000000039b', '직접', repeat('README ', 10))$$,
  '42501', null, '브라우저에서 프로젝트를 직접 넣을 수 없다'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000039a", "role": "authenticated"}';
select is(
  (select count(*) from public.questions where project_id = (select id from ids where name = 'p1')),
  5::bigint,
  '내 프로젝트 질문은 세션이 없어도 읽는다'
);
reset role;

select throws_ok(
  $$select public.delete_project('00000000-0000-0000-0000-00000000039b', (select id from ids where name = 'p1'))$$,
  'NOT_OWNER', '남의 프로젝트는 지우지 못한다'
);

-- 오늘의 질문(복습으로 나온 프로젝트 질문)이면 그날은 지우지 못한다
select public.apply_review('00000000-0000-0000-0000-00000000039a', (select max(id) from pq), false);
select public.set_bookmark('00000000-0000-0000-0000-00000000039a', (select min(id) from pq), true);
select public.start_daily_session('00000000-0000-0000-0000-00000000039a', (select max(id) from pq), 'review');
select throws_ok(
  $$select public.delete_project('00000000-0000-0000-0000-00000000039a', (select id from ids where name = 'p1'))$$,
  'PROJECT_IN_TODAY_SESSION', '오늘의 질문으로 나온 프로젝트는 지우지 못한다'
);

-- 다음 날이 되면(오늘 세션을 어제로 옮겨 흉내 낸다) 지울 수 있고, 질문·세션·턴·복습·북마크·정답지가 함께 지워진다
update public.sessions set day = day - 1
where user_id = '00000000-0000-0000-0000-00000000039a' and kind = 'daily';
select public.delete_project('00000000-0000-0000-0000-00000000039a', (select id from ids where name = 'p1'));
select is(
  (select count(*) from public.questions where id in (select id from pq))
  + (select count(*) from public.question_keys where question_id in (select id from pq))
  + (select count(*) from public.sessions where question_id in (select id from pq))
  + (select count(*) from public.turns where session_id = (select id from ids where name = 's1'))
  + (select count(*) from public.reviews where question_id in (select id from pq))
  + (select count(*) from public.bookmarks where question_id in (select id from pq)),
  0::bigint,
  '지우면 그 질문과 기록, 복습 일정, 북마크가 함께 지워진다'
);

select * from finish();
rollback;
