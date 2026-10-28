-- 학습 자료로 면접 질문 만들기(#141, 04 기능 명세 9번 "학습 자료")
begin;
select plan(26);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000141a', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-00000000141b', '{"name": "비비"}');

insert into public.questions (id, topic_id, level, prompt) values
  (94141, 'jpa', 'mid', '테스트 질문: 영속성 컨텍스트');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

create function pg_temp.five() returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'prompt', '테스트 학습 자료 질문 ' || n,
    'rubric', jsonb_build_object('keywords', jsonb_build_array('문맥 교환'), 'criteria', jsonb_build_array('차이를 말한다')),
    'model_answer', '예시 답안 ' || n))
  from generate_series(1, 5) n
$$;

-- 질문 생성은 프로젝트와 함께 하루 1회라 등록할 때마다 예약 날짜를 하루 앞으로 옮긴다
insert into ids select 'n1', (public.create_note('00000000-0000-0000-0000-00000000141a', '운영체제', repeat('# 프로세스 ', 10))).id;
select results_eq(
  $$select purpose, quota, status from public.ai_usage where ref_id = (select id from ids where name = 'n1')$$,
  $$values ('note_gen', 'project_gen', 'reserved')$$,
  '등록하면 생성 몫을 note_gen으로 예약하고 하루 한도는 프로젝트와 같은 몫으로 센다'
);
select throws_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000141a', '혜자', repeat('README ', 10))$$,
  'LIMIT_EXCEEDED', '같은 날 학습 자료를 등록했으면 프로젝트도 등록하지 못한다(하루 1회를 함께 센다)'
);
update public.ai_usage set day = day - 1 where user_id = '00000000-0000-0000-0000-00000000141a';
insert into ids select 'n2', (public.create_note('00000000-0000-0000-0000-00000000141a', '네트워크', repeat('# TCP ', 10))).id;
update public.ai_usage set day = day - 1 where user_id = '00000000-0000-0000-0000-00000000141a';
insert into ids select 'n3', (public.create_note('00000000-0000-0000-0000-00000000141a', '자료구조', repeat('# 해시 ', 10))).id;
update public.ai_usage set day = day - 1 where user_id = '00000000-0000-0000-0000-00000000141a';
select is(
  (select status from public.study_notes where id = (select id from ids where name = 'n1')),
  'generating',
  '등록하면 generating으로 저장한다'
);
select throws_ok(
  $$select public.create_note('00000000-0000-0000-0000-00000000141a', '네 번째', repeat('# 노트 ', 10))$$,
  'NOTE_LIMIT', '4번째 학습 자료는 등록하지 못한다'
);
select lives_ok(
  $$select public.create_project('00000000-0000-0000-0000-00000000141a', '혜자', repeat('README ', 10))$$,
  '학습 자료 3개 제한은 프로젝트 3개와 따로 센다'
);
select throws_ok(
  $$select public.create_note('00000000-0000-0000-0000-00000000141b', '짧음', '짧은 노트')$$,
  '23514', null, '내용이 30자보다 짧으면 저장하지 않는다'
);

-- 생성 결과 저장: 질문 5개 + 정답지, ready
select public.save_note_questions((select id from ids where name = 'n1'), pg_temp.five(), null);
select is(
  (select status from public.study_notes where id = (select id from ids where name = 'n1')),
  'ready',
  '질문을 저장하면 ready'
);
select is(
  (select count(*) from public.questions q join public.question_keys k on k.question_id = q.id
   where q.note_id = (select id from ids where name = 'n1')
     and q.project_id is null and q.topic_id is null and q.level is null and k.links is null),
  5::bigint,
  '질문 5개와 채점 기준을 저장한다(세부 주제·난이도·링크 없음)'
);
select throws_ok(
  $$select public.save_note_questions((select id from ids where name = 'n1'), pg_temp.five(), null)$$,
  'NOT_GENERATING', '이미 저장한 학습 자료에 다시 저장하지 않는다'
);
select throws_ok(
  $$select public.save_note_questions((select id from ids where name = 'n2'), pg_temp.five() - 0, null)$$,
  'VALIDATION', '질문이 5개가 아니면 저장하지 않는다'
);
select throws_ok(
  $$insert into public.questions (prompt, project_id, note_id)
    values ('둘 다', (select id from public.projects limit 1), (select id from ids where name = 'n1'))$$,
  '23514', null, '질문은 프로젝트와 학습 자료 중 하나에만 딸린다'
);
select is(
  (select count(*) from public.bank_questions where id in
    (select id from public.questions where note_id = (select id from ids where name = 'n1'))),
  0::bigint,
  '학습 자료 질문은 출제 후보(bank_questions)에 들어가지 않는다'
);

-- 실패와 다시 생성
select public.save_note_questions((select id from ids where name = 'n2'), null, 'timeout');
select results_eq(
  $$select status, error_code from public.study_notes where id = (select id from ids where name = 'n2')$$,
  $$values ('failed', 'timeout')$$,
  '생성이 실패하면 failed와 에러 코드'
);
select throws_ok(
  $$select public.restart_note_generation('00000000-0000-0000-0000-00000000141b', (select id from ids where name = 'n2'))$$,
  'NOT_OWNER', '남의 학습 자료는 다시 생성하지 못한다'
);
select is(
  (public.restart_note_generation('00000000-0000-0000-0000-00000000141a', (select id from ids where name = 'n2'))).status,
  'generating',
  '실패한 학습 자료는 다시 생성할 수 있다'
);

-- 연습 세션: 프로젝트 질문과 같은 함수·같은 세션 종류
create temp table nq as
  select id from public.questions where note_id = (select id from ids where name = 'n1') order by id;
insert into ids select 's1', (public.start_project_session('00000000-0000-0000-0000-00000000141a', (select min(id) from nq))).id;
select results_eq(
  $$select s.kind, s.status, (select count(*) from public.turns t where t.session_id = s.id and t.idx = 0)
    from public.sessions s where s.id = (select id from ids where name = 's1')$$,
  $$values ('project', 'open', 1::bigint)$$,
  '학습 자료 질문으로 연습 세션과 본 질문 턴을 만든다'
);
select throws_ok(
  $$select public.start_project_session('00000000-0000-0000-0000-00000000141b', (select min(id) from nq))$$,
  'NOT_OWNER', '남의 학습 자료 질문으로는 세션을 열지 못한다'
);
select throws_ok(
  $$select public.start_project_session('00000000-0000-0000-0000-00000000141a', 94141)$$,
  'NOT_FOUND', '은행 질문은 연습 세션으로 열지 않는다'
);

-- 브라우저에서는 자기 학습 자료와 그 질문만 읽고, 직접 쓰지 못한다
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000141b", "role": "authenticated"}';
select is(
  (select count(*) from public.questions where note_id is not null) + (select count(*) from public.study_notes),
  0::bigint,
  '남의 학습 자료와 그 질문은 읽지 못한다'
);
select throws_ok(
  $$insert into public.study_notes (user_id, title, content) values ('00000000-0000-0000-0000-00000000141b', '직접', repeat('# 노트 ', 10))$$,
  '42501', null, '브라우저에서 학습 자료를 직접 넣을 수 없다'
);
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000141a", "role": "authenticated"}';
select is(
  (select count(*) from public.questions where note_id = (select id from ids where name = 'n1')),
  5::bigint,
  '내 학습 자료 질문은 세션이 없어도 읽는다'
);
reset role;

select throws_ok(
  $$select public.delete_note('00000000-0000-0000-0000-00000000141b', (select id from ids where name = 'n1'))$$,
  'NOT_OWNER', '남의 학습 자료는 지우지 못한다'
);

-- 오늘의 질문(복습으로 나온 학습 자료 질문)이면 그날은 지우지 못한다
select public.apply_review('00000000-0000-0000-0000-00000000141a', (select max(id) from nq), false);
select public.set_bookmark('00000000-0000-0000-0000-00000000141a', (select min(id) from nq), true);
select public.start_daily_session('00000000-0000-0000-0000-00000000141a', (select max(id) from nq), 'review');
select throws_ok(
  $$select public.delete_note('00000000-0000-0000-0000-00000000141a', (select id from ids where name = 'n1'))$$,
  'NOTE_IN_TODAY_SESSION', '오늘의 질문으로 나온 학습 자료는 지우지 못한다'
);

-- 다음 날이 되면 지울 수 있고, 질문·세션·턴·복습·북마크·정답지가 함께 지워진다
update public.sessions set day = day - 1
where user_id = '00000000-0000-0000-0000-00000000141a' and kind = 'daily';
select public.delete_note('00000000-0000-0000-0000-00000000141a', (select id from ids where name = 'n1'));
select is(
  (select count(*) from public.questions where id in (select id from nq))
  + (select count(*) from public.question_keys where question_id in (select id from nq))
  + (select count(*) from public.sessions where question_id in (select id from nq))
  + (select count(*) from public.turns where session_id = (select id from ids where name = 's1'))
  + (select count(*) from public.reviews where question_id in (select id from nq))
  + (select count(*) from public.bookmarks where question_id in (select id from nq)),
  0::bigint,
  '지우면 그 질문과 기록, 복습 일정, 북마크가 함께 지워진다'
);

-- 내용 한도는 30,000자(#144, 프로젝트 README는 10,000자 그대로)
select lives_ok(
  $$insert into public.study_notes (user_id, title, content) values ('00000000-0000-0000-0000-00000000141b', '긴 자료', repeat('가', 30000))$$,
  '내용은 30,000자까지 저장한다'
);
select throws_ok(
  $$insert into public.study_notes (user_id, title, content) values ('00000000-0000-0000-0000-00000000141b', '너무 긴 자료', repeat('가', 30001))$$,
  '23514', null, '30,000자를 넘으면 저장하지 않는다'
);

select * from finish();
rollback;
