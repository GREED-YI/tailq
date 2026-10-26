-- 학습 기록 목록(04 기능 명세 E-1)은 "내 세션 전부를 날짜 역순으로" 읽는다(RLS가 user_id = auth.uid()를 붙인다).
-- sessions_daily_day는 kind = 'daily'만 담는 부분 인덱스라 kind로 거르지 않는 이 조회에는 쓰이지 않는다.
-- 기록에는 프로젝트 질문 세션(#39)도 나오므로 kind 없이 user_id로 거는 인덱스를 둔다.
-- 탈퇴할 때 auth.users에서 sessions로 이어지는 cascade 삭제도 이 인덱스로 찾는다.
create index sessions_user_day on public.sessions (user_id, day desc);
