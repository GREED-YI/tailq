-- 세부 주제 15개 (04 기능 명세 "연습 범위 선택지"). 비밀이 아니라 공개 저장소 시드로 넣는다.
create table public.topics (
  id text primary key,
  field text not null check (field in ('cs', 'backend', 'frontend')),
  name text not null,
  sort int not null
);

alter table public.topics enable row level security;

-- 읽기만 열고 쓰기 정책은 두지 않는다(08 설계 "데이터 읽고 쓰는 길")
create policy "topics: 로그인한 사람 누구나 읽기"
  on public.topics for select
  to authenticated
  using (true);
