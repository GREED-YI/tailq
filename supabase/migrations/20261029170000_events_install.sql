-- 앱 설치 버튼 지표(#150). 브라우저가 POST /api/events로 보내는 이름 두 개를 허용 목록에 더한다.
-- 이름별 props(20261027200000_events.sql 머리 주석에 더해):
--   install_click {}   설치 버튼을 누른 순간(설치 창이든 아이폰 안내든)
--   app_installed {}   브라우저가 appinstalled를 알렸을 때(주소창 설치 아이콘으로 설치해도 온다)
-- 설치 창에서 거절한 것은 남기지 않는다
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in (
  'first_visit', 'trial_start', 'trial_complete', 'signup', 'session_start',
  'answer_submit', 'session_complete', 'rating', 'share', 'notification_click',
  'install_click', 'app_installed'
));
