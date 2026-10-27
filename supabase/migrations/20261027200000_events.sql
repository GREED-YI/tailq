-- 지표 이벤트(#44, 04 기능 명세 12장, 08 설계 "공유 · 운영"·7장). 다른 테이블과 외래키로 묶지 않는다.
-- 정책을 두지 않아 브라우저(anon·authenticated)는 읽지도 쓰지도 못한다. 서버가 service_role로 record_event를 부른다.
-- 이름별 props(답변 글은 넣지 않는다):
--   first_visit {}, notification_click {}                      브라우저가 POST /api/events로 보낸다
--   signup {}, trial_start {field}, trial_complete {session_id}, share {session_id}
--   session_start·session_complete {session_id, kind}, answer_submit {session_id, turn_id, kind, dont_know}
--   rating {turn_id, rating}
create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name in (
    'first_visit', 'trial_start', 'trial_complete', 'signup', 'session_start',
    'answer_submit', 'session_complete', 'rating', 'share', 'notification_click'
  )),
  user_id uuid,
  anon_id uuid,
  props jsonb not null default '{}'
    check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1024),
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;

create index events_created on public.events (created_at);
create index events_anon on public.events (anon_id, created_at) where anon_id is not null;
create index events_user on public.events (user_id, created_at) where user_id is not null;

-- 이벤트 한 줄. 비로그인도 보낼 수 있는 입구라 같은 브라우저(anon_id)는 24시간에 200건까지만 받고 나머지는 버린다.
-- ponytail: 동시에 오면 200을 조금 넘을 수 있다. 정확해야 하면 anon_id 잠금을 건다
create function public.record_event(
  p_name text, p_user_id uuid default null, p_anon_id uuid default null, p_props jsonb default '{}'
)
returns void
language sql
set search_path = ''
as $$
  insert into public.events (name, user_id, anon_id, props)
  select p_name, p_user_id, p_anon_id, coalesce(p_props, '{}')
  where p_anon_id is null
     or (select count(*) from public.events
         where anon_id = p_anon_id and created_at > now() - interval '24 hours') < 200;
$$;

-- 탈퇴(08 설계 "탈퇴" 3번): 그 사용자의 이벤트와, 그 사용자가 쓴 브라우저(anon_id)의 로그인 전 이벤트를 지운다
create function public.delete_user_events(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.events
  where user_id = p_user_id
     or anon_id in (
       select anon_id from public.events where user_id = p_user_id and anon_id is not null
     );
$$;

-- 보관 기간 90일(08 설계 7장, 개인정보처리방침 "이용 이벤트: 90일 뒤 지워요")
create function public.purge_old_events()
returns void
language sql
set search_path = ''
as $$
  delete from public.events where created_at < now() - interval '90 days';
$$;

revoke execute on function public.record_event(text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_event(text, uuid, uuid, jsonb) to service_role;
revoke execute on function public.delete_user_events(uuid) from public, anon, authenticated;
grant execute on function public.delete_user_events(uuid) to service_role;
revoke execute on function public.purge_old_events() from public, anon, authenticated;
grant execute on function public.purge_old_events() to service_role;

-- 매일 4시(KST) = 19시(UTC) 새벽 정리. 체험 정리(#40)도 같은 시각에 SQL로 붙인다
create extension if not exists pg_cron;
select cron.schedule('purge-old-events', '0 19 * * *', 'select public.purge_old_events()');

-- 성공 지표(01 프로젝트 정의) 4가지를 주(월요일 시작, KST)별로 센다. 월 운영비는 ai_usage(#43)에서 본다.
--   answers                  주간 답변 제출 수(북극성). 본 질문 제출, 다시 채점은 같은 turn_id라 한 번만
--   first_visitors(_answered) 그 주 첫 방문 브라우저 중 언제든 답변까지 간 수(체험·가입 후 답변 모두)
--   d7_cohort / d7_returned  그 주 가입자 중 7일이 다 지난 사람 / 가입 다음 날부터 7일 안에 다시 이벤트를 남긴 사람
--   ratings / thumbs_up      그 주에 마지막으로 남긴 턴별 평가 수 / 그중 👍
create view public.metrics_weekly
with (security_invoker = true) as
with e as (
  select name, user_id, anon_id, props, created_at,
    (created_at at time zone 'Asia/Seoul')::date as day
  from public.events
),
answers as (
  select date_trunc('week', day)::date as week, count(distinct props ->> 'turn_id') as answers
  from e where name = 'answer_submit'
  group by 1
),
visits as (
  select v.week, count(*) as first_visitors,
    count(*) filter (where exists (
      select 1 from e a where a.name = 'answer_submit' and a.anon_id = v.anon_id
    )) as first_visitors_answered
  from (
    select anon_id, date_trunc('week', min(day))::date as week
    from e where name = 'first_visit' and anon_id is not null
    group by anon_id
  ) v
  group by 1
),
d7 as (
  select date_trunc('week', s.day)::date as week,
    count(*) filter (where s.day + 7 < (now() at time zone 'Asia/Seoul')::date) as d7_cohort,
    count(*) filter (where s.day + 7 < (now() at time zone 'Asia/Seoul')::date and exists (
      select 1 from e r where r.user_id = s.user_id and r.day between s.day + 1 and s.day + 7
    )) as d7_returned
  from (
    select user_id, min(day) as day from e where name = 'signup' and user_id is not null
    group by user_id
  ) s
  group by 1
),
ratings as (
  select date_trunc('week', day)::date as week, count(*) as ratings,
    count(*) filter (where rating = 1) as thumbs_up
  from (
    select distinct on (props ->> 'turn_id') day, (props ->> 'rating')::int as rating
    from e where name = 'rating'
    order by props ->> 'turn_id', created_at desc
  ) last_rating
  group by 1
)
select w.week,
  coalesce(a.answers, 0) as answers,
  coalesce(v.first_visitors, 0) as first_visitors,
  coalesce(v.first_visitors_answered, 0) as first_visitors_answered,
  round(v.first_visitors_answered::numeric / nullif(v.first_visitors, 0), 3) as first_answer_rate,
  coalesce(d.d7_cohort, 0) as d7_cohort,
  coalesce(d.d7_returned, 0) as d7_returned,
  round(d.d7_returned::numeric / nullif(d.d7_cohort, 0), 3) as d7_rate,
  coalesce(r.ratings, 0) as ratings,
  coalesce(r.thumbs_up, 0) as thumbs_up,
  round(r.thumbs_up::numeric / nullif(r.ratings, 0), 3) as thumbs_up_rate
from (select distinct date_trunc('week', day)::date as week from e) w
left join answers a using (week)
left join visits v using (week)
left join d7 d using (week)
left join ratings r using (week)
order by w.week desc;

revoke all on public.metrics_weekly from anon, authenticated;
