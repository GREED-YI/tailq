-- 사용자 프로필 (08 설계 3장 "사용자"). 행은 가입할 때 handle_new_user 트리거가 만든다.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 12),
  -- 소셜 사진 URL 또는 기본 아바타 키
  avatar text,
  topics text[] not null default '{}',
  levels text[] not null default '{}',
  notify_on boolean not null default false,
  notify_hour smallint not null default 8 check (notify_hour between 0 and 23),
  -- 같은 날 알림을 두 번 보내지 않게 마지막 발송일(KST)을 적는다
  last_notified_day date,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  agreed_at timestamptz,
  -- null이면 아직 온보딩 전(첫 로그인)
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 자기 행만 읽는다. 쓰기 정책은 두지 않는다(08 설계 "데이터 읽고 쓰는 길")
create policy "profiles: 자기 행만 읽기"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- 가입하면 프로필을 만든다. 닉네임·아바타는 소셜 계정 정보에서 가져온다.
-- 이름이 없거나 2자보다 짧으면 기본 닉네임을 쓰고, 12자보다 길면 자른다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := btrim(left(btrim(coalesce(
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'user_name'), ''),
    ''
  )), 12));
begin
  insert into public.profiles (id, nickname, avatar)
  values (
    new.id,
    case when char_length(name) >= 2 then name else '면접 준비생' end,
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );
  return new;
end;
$$;

-- 트리거로만 돈다. 브라우저 rpc()로 부르지 못하게 닫는다
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
