-- 질문 북마크(#35, 04 기능 명세 E-4, 08 설계 "bookmarks")
create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id int not null references public.questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- 읽기 정책만 두고 쓰기는 서버의 DB 함수로만 한다(08 설계 "데이터 읽고 쓰는 길")
alter table public.bookmarks enable row level security;

create policy "bookmarks: 자기 행만 읽기"
  on public.bookmarks for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 질문 읽기 정책에 북마크를 더한다(08 설계 "questions 읽기 정책"). 프로젝트 조건은 그 테이블이 생길 때 더한다
drop policy "questions: 내 세션·복습의 질문만 읽기" on public.questions;
create policy "questions: 내 세션·복습·북마크의 질문만 읽기"
  on public.questions for select
  to authenticated
  using (
    exists (select 1 from public.sessions s where s.question_id = questions.id and s.user_id = (select auth.uid()))
    or exists (select 1 from public.reviews r where r.question_id = questions.id and r.user_id = (select auth.uid()))
    or exists (select 1 from public.bookmarks b where b.question_id = questions.id and b.user_id = (select auth.uid()))
  );

-- 북마크 저장(p_on = true)·해제. 여러 번 불러도 결과가 같다(08 설계 "멱등성").
-- 북마크는 질문 읽기 정책을 넓히므로, 내 세션에 나온 질문만 저장한다(아니면 아무 질문이나 읽을 수 있게 된다)
create function public.set_bookmark(p_user_id uuid, p_question_id int, p_on boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not p_on then
    delete from public.bookmarks where user_id = p_user_id and question_id = p_question_id;
    return;
  end if;
  if not exists (
    select 1 from public.sessions where user_id = p_user_id and question_id = p_question_id
  ) then
    raise exception 'NOT_FOUND';
  end if;
  insert into public.bookmarks (user_id, question_id) values (p_user_id, p_question_id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_bookmark(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.set_bookmark(uuid, int, boolean) to service_role;
