-- 실패한 질문 다시 생성은 프로젝트·학습 자료를 합쳐 한국 시간 하루 3번(docs/10 보안 점검 "남용 제한", #99)
begin;
select plan(12);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000099c1', '{"name": "에이"}'),
  ('00000000-0000-0000-0000-0000000099c2', '{"name": "비비"}');

create temp table ids (name text primary key, id uuid);
insert into ids select 'p1', (public.create_project('00000000-0000-0000-0000-0000000099c1', '혜자', repeat('README ', 10))).id;
insert into ids select 'p2', (public.create_project('00000000-0000-0000-0000-0000000099c2', '비비', repeat('README ', 10))).id;
update public.projects set status = 'failed' where id in (select id from ids);
-- 등록 때 예약한 첫 생성 몫은 첫 생성이 이미 썼다
update public.ai_usage set status = 'failed' where ref_id in (select id from ids) and quota = 'project_gen';

-- 생성이 끝나 다시 실패한 것처럼 만든다
create function pg_temp.fail(p_project uuid) returns void language sql as $$
  update public.projects set status = 'failed' where id = p_project;
$$;
create function pg_temp.restart(p_user uuid, p_project uuid) returns void language plpgsql as $$
begin
  perform public.restart_project_generation(p_user, p_project);
end;
$$;

select is(
  (public.ai_quota('00000000-0000-0000-0000-0000000099c1', null) ->> 'regens_left')::int, 3,
  '다시 생성은 하루 3번 남아 있다'
);

select pg_temp.restart('00000000-0000-0000-0000-0000000099c1', (select id from ids where name = 'p1'));
select is(
  (
    select row(purpose, status)::text from public.ai_usage
    where ref_id = (select id from ids where name = 'p1') and quota = 'project_regen'
  ),
  row('project_gen', 'reserved')::text,
  '다시 생성하면 몫을 reserved로 예약한다'
);

select public.record_ai_usage(
  '00000000-0000-0000-0000-0000000099c1', 'project_gen', (select id from ids where name = 'p1'),
  '{"status": "failed", "model": "claude-sonnet-5-5", "error_code": "schema_invalid", "cost_usd": 0.02}'
);
select is(
  (select status from public.ai_usage where ref_id = (select id from ids where name = 'p1') and quota = 'project_regen'),
  'failed',
  '생성 호출 기록은 예약한 행을 바꾼다(새 행을 만들지 않는다)'
);
select is(
  (public.ai_quota('00000000-0000-0000-0000-0000000099c1', null) ->> 'regens_left')::int, 2,
  '실패한 생성도 그날 다시 생성 횟수에 들어간다'
);

select pg_temp.fail((select id from ids where name = 'p1'));
select pg_temp.restart('00000000-0000-0000-0000-0000000099c1', (select id from ids where name = 'p1'));
select pg_temp.fail((select id from ids where name = 'p1'));
select pg_temp.restart('00000000-0000-0000-0000-0000000099c1', (select id from ids where name = 'p1'));
select pg_temp.fail((select id from ids where name = 'p1'));

select throws_ok(
  $$select public.restart_project_generation('00000000-0000-0000-0000-0000000099c1', (select id from ids where name = 'p1'))$$,
  'REGEN_LIMIT', '같은 날 네 번째 다시 생성은 막는다'
);
select is(
  (select status from public.projects where id = (select id from ids where name = 'p1')),
  'failed', '막힌 다시 생성은 프로젝트를 generating으로 바꾸지 않는다'
);
select is(
  (select row(q ->> 'regens_left', q ->> 'sessions_left')::text
   from public.ai_quota('00000000-0000-0000-0000-0000000099c1', null) q),
  row('0', '3')::text,
  '다시 생성 몫은 연습 한도와 따로 센다'
);

-- 학습 자료 다시 생성도 같은 하루 3번을 센다
with n as (
  insert into public.study_notes (user_id, title, content, status)
  values ('00000000-0000-0000-0000-0000000099c1', '노트', repeat('학습 자료 ', 10), 'failed') returning id
)
insert into ids select 'n1', id from n;
select throws_ok(
  $$select public.restart_note_generation('00000000-0000-0000-0000-0000000099c1', (select id from ids where name = 'n1'))$$,
  'REGEN_LIMIT', '프로젝트에서 3번 썼으면 학습 자료 다시 생성도 막는다'
);
with n as (
  insert into public.study_notes (user_id, title, content, status)
  values ('00000000-0000-0000-0000-0000000099c2', '노트', repeat('학습 자료 ', 10), 'failed') returning id
)
insert into ids select 'n2', id from n;
select is(
  (public.restart_note_generation('00000000-0000-0000-0000-0000000099c2', (select id from ids where name = 'n2'))).status,
  'generating', '실패한 학습 자료는 다시 생성할 수 있다'
);
select is(
  (
    select row(purpose, status)::text from public.ai_usage
    where ref_id = (select id from ids where name = 'n2') and quota = 'project_regen'
  ),
  row('note_gen', 'reserved')::text,
  '학습 자료 다시 생성은 note_gen 몫을 예약한다'
);

select is(
  (public.restart_project_generation('00000000-0000-0000-0000-0000000099c2', (select id from ids where name = 'p2'))).status,
  'generating', '다른 사람의 한도에는 영향이 없다'
);

-- 다음 날(한국 시간)이면 다시 3번
update public.ai_usage set day = day - 1 where user_id = '00000000-0000-0000-0000-0000000099c1';
select is(
  (public.restart_project_generation('00000000-0000-0000-0000-0000000099c1', (select id from ids where name = 'p1'))).status,
  'generating', '다음 날에는 다시 생성할 수 있다'
);

select * from finish();
rollback;
