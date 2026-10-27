-- 앱 안 피드백(#101, 04 기능 명세 12장). 보낸 사람은 다시 읽지 않고 운영자만 운영 대시보드에서 읽는다
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 5 and 1000),
  created_at timestamptz not null default now()
);

-- 하루 보내기 횟수를 셀 때 쓴다
create index feedback_user_created on public.feedback (user_id, created_at desc);

-- 정책을 두지 않아 사용자 권한(anon·authenticated)으로는 읽지도 쓰지도 못한다.
-- 서버가 로그인을 확인한 뒤 service_role로 쓰고, 운영자 확인 뒤 service_role로 읽는다(08 설계 "데이터 읽고 쓰는 길")
alter table public.feedback enable row level security;

-- 피드백 넣기. 24시간에 p_daily개를 넘으면 FEEDBACK_LIMIT을 낸다.
-- 같은 사용자의 동시 요청이 세고 넣는 사이에 끼어들지 않게 사용자별 잠금으로 줄 세운다
create function public.send_feedback(p_user_id uuid, p_body text, p_daily int)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('feedback:' || p_user_id::text, 0));
  if (
    select count(*) from public.feedback
    where user_id = p_user_id and created_at > now() - interval '24 hours'
  ) >= p_daily then
    raise exception 'FEEDBACK_LIMIT';
  end if;
  insert into public.feedback (user_id, body) values (p_user_id, p_body);
end;
$$;

revoke execute on function public.send_feedback(uuid, text, int) from public, anon, authenticated;
grant execute on function public.send_feedback(uuid, text, int) to service_role;
