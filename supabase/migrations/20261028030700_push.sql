-- 웹 푸시 알림(#37, 04 기능 명세 7장, 08 설계 "웹 푸시").
-- 브라우저 구독 정보는 기기마다 한 줄. 같은 endpoint를 다시 보내면 그 줄을 고친다(POST /api/push-subscriptions).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique
    check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth_key text not null check (char_length(auth_key) between 1 and 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

-- 자기 행만 읽는다(MY가 이 기기의 구독 id를 찾을 때). 쓰기는 서버가 service_role로 한다
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: 자기 행만 읽기"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 이번 시각(KST)에 알림을 받을 사람을 p_limit명까지 고르면서 같은 문장으로 last_notified_day를 오늘로 적는다.
-- 한 번에 돌려주는 행이 API 최대 행 수(max_rows)를 넘지 않게 묶음으로 나눈다. 서버는 빈 묶음이 올 때까지 다시 부른다.
-- 핸들러가 두 번 돌아도(pg_net 재시도, 배포 중 겹침) 같은 날 두 번 고르지 않는다. 동시에 돌면
-- 다른 실행이 잠근 행은 건너뛰고(skip locked), 이미 적힌 행은 last_notified_day를 다시 보고 건너뛴다.
-- 대상: 알림 켬 · 이 시각을 골랐음 · 오늘 아직 안 보냄 · 구독한 기기가 있음 · 오늘 본 질문을 아직 제출하지 않음.
-- review: 복습일이 된 질문(숨긴 질문 제외)이 있으면 true. 세션은 만들지 않는다(질문은 첫 접속 때 고른다).
create function public.pick_push_targets(p_now timestamptz default now(), p_limit int default 100)
returns table (user_id uuid, review boolean)
language sql
set search_path = ''
as $$
  with now_kst as (
    select (p_now at time zone 'Asia/Seoul')::date as day,
           extract(hour from p_now at time zone 'Asia/Seoul')::int as hour
  ),
  picked as (
    select p.id
    from public.profiles p, now_kst n
    where p.notify_on
      and p.notify_hour = n.hour
      and (p.last_notified_day is null or p.last_notified_day < n.day)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
      and not exists (
        select 1
        from public.sessions se
        join public.turns t on t.session_id = se.id
        where se.user_id = p.id and se.kind = 'daily' and se.day = n.day
          and t.idx = 0 and t.answered_at is not null
      )
    limit p_limit
    for update of p skip locked
  )
  update public.profiles p
  set last_notified_day = n.day
  from now_kst n, picked
  where p.id = picked.id
  returning p.id, exists (
    select 1
    from public.reviews r
    join public.questions q on q.id = r.question_id
    where r.user_id = p.id and r.box is not null and r.due_day <= n.day
      and not q.is_hidden
  );
$$;

revoke execute on function public.pick_push_targets(timestamptz, int) from public, anon, authenticated;
grant execute on function public.pick_push_targets(timestamptz, int) to service_role;

-- 매시 정각 pg_cron → pg_net으로 POST /api/cron/push를 부른다. 주소와 비밀값은 vault.secrets에 두고
-- cron.schedule 문장에는 쓰지 않는다. 둘 중 하나라도 없으면(로컬 등) 아무것도 하지 않는다.
-- 비밀값을 머리글에 실어 보내므로 https 주소가 아니면 보내지 않는다.
--   select vault.create_secret('https://<도메인>/api/cron/push', 'push_cron_url');
--   select vault.create_secret('<CRON_SECRET과 같은 값>', 'cron_secret');
create extension if not exists pg_net with schema extensions;

create function public.request_push_cron()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null or v_url not like 'https://%' then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

-- pg_cron(postgres)만 부른다
revoke execute on function public.request_push_cron() from public, anon, authenticated;

select cron.schedule('send-push', '0 * * * *', 'select public.request_push_cron()');
