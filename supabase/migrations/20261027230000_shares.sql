-- 결과 공유 카드(#41, 04 기능 명세 8번, 08 설계 "공유 · 운영").
-- 카드에는 닉네임(뺄 수 있음), 질문 주제, 점수, 꼬리잇기만 둔다. 질문 원문·답변·프로필 이미지는 넣지 않는다.
-- 정책을 두지 않아 브라우저(anon·authenticated)는 읽지도 쓰지도 못한다. 공유 페이지는 서버가 id 하나로만 읽는다.
-- 세션이 지워지면(탈퇴·프로젝트 삭제) 카드도 지워진다.
create table public.shares (
  -- 링크에 들어가는 짧은 무작위 문자열(16진수 12자 = 48비트). 맞혀서 남의 카드를 찾을 수 없을 만큼 길다
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  -- null이면 닉네임을 뺀 카드
  nickname text,
  topic_name text not null,
  score smallint not null check (score between 0 and 100),
  streak int not null default 0 check (streak >= 0),
  created_at timestamptz not null default now()
);
alter table public.shares enable row level security;

-- 카드 만들기. sessionId만 받고 점수·주제·닉네임은 DB가 채운다(위조 방지). 꼬리잇기는 서버가 계산해 넘긴다.
-- 세션당 하나라 다시 부르면 기존 카드 id를 돌려준다. 이때 닉네임만 지금 설정(profiles.share_nickname)으로 고친다
-- (닉네임 공개를 끈 뒤 다시 공유하면 빠지게). 내 세션이 아니거나, 체험이거나, 본 질문 점수가 없으면 null.
create function public.create_share(p_user_id uuid, p_session_id uuid, p_streak int)
returns text
language plpgsql
set search_path = ''
as $$
declare
  result text;
begin
  insert into public.shares (session_id, nickname, topic_name, score, streak)
  select s.id,
    case when p.share_nickname then p.nickname end,
    case when q.project_id is not null then '내 프로젝트' else t.name end,
    t0.score,
    greatest(coalesce(p_streak, 0), 0)
  from public.sessions s
  join public.turns t0 on t0.session_id = s.id and t0.idx = 0
  join public.questions q on q.id = s.question_id
  left join public.topics t on t.id = q.topic_id
  join public.profiles p on p.id = s.user_id
  where s.id = p_session_id and s.user_id = p_user_id and s.kind <> 'trial'
    and t0.score is not null
  on conflict (session_id) do update set nickname = excluded.nickname
  returning id into result;
  return result;
end;
$$;

revoke execute on function public.create_share(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.create_share(uuid, uuid, int) to service_role;
