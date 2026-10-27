-- 피드백 분류(#118, 04 기능 명세 12장): 바라는 기능 · 버그 · 신고 · 기타. 운영 대시보드에서 나눠 본다.
-- 이미 받은 피드백은 분류가 없었으니 기타로 둔다
alter table public.feedback
  add column category text not null default 'etc'
  check (category in ('feature', 'bug', 'report', 'etc'));

-- 분류를 받도록 바꾼다. 분류를 빼고 부르면(이전 서버 코드) 기타로 넣는다
drop function public.send_feedback(uuid, text, int);
create function public.send_feedback(
  p_user_id uuid,
  p_body text,
  p_daily int,
  p_category text default 'etc'
)
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
  insert into public.feedback (user_id, body, category) values (p_user_id, p_body, p_category);
end;
$$;

revoke execute on function public.send_feedback(uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.send_feedback(uuid, text, int, text) to service_role;
