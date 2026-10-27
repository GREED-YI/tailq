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
