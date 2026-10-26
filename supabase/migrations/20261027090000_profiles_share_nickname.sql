-- 공유 카드에 닉네임을 넣을지(04 기능 명세 "프로필": 공유 카드에서는 닉네임을 뺄 수 있다).
-- 끄면 공유 카드에 'TailQ 사용자'로 보인다. 기본은 넣는다.
alter table public.profiles
  add column share_nickname boolean not null default true;
