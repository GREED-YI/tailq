-- 온보딩 규칙을 DB가 한 번 더 지킨다(04 기능 명세 "2. 온보딩").
-- 동의하지 않았거나 주제를 하나도 고르지 않았으면 온보딩을 마칠 수 없고,
-- 마친 뒤에도 연습 범위를 비울 수 없다(비면 오늘의 질문을 고를 수 없다).
alter table public.profiles
  add constraint profiles_levels_known
    check (levels <@ array['basic', 'mid', 'deep']),
  add constraint profiles_onboarded_ready
    check (
      onboarded_at is null
      or (agreed_at is not null and cardinality(topics) > 0 and cardinality(levels) > 0)
    );
