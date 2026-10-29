-- 화면 테마는 기기(localStorage, lib/theme.ts)에 두고 앱이 이 열을 읽거나 쓰지 않는다 (#132).
-- 열에만 걸린 check 제약(profiles_theme_check)과 기본값도 함께 지워진다
alter table public.profiles drop column theme;
