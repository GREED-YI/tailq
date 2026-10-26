-- 로컬 `supabase db reset` 때 들어가는 공개 시드. 질문 은행은 비공개 저장소에서 넣는다(08 설계 5장).
insert into public.topics (id, field, name, sort) values
  ('dsa', 'cs', '자료구조·알고리즘', 1),
  ('network', 'cs', '네트워크', 2),
  ('os', 'cs', '운영체제', 3),
  ('database', 'cs', '데이터베이스', 4),
  ('java', 'backend', 'Java', 5),
  ('spring', 'backend', 'Spring', 6),
  ('jpa', 'backend', 'JPA', 7),
  ('concurrency', 'backend', '트랜잭션·동시성', 8),
  ('security', 'backend', '인증·보안', 9),
  ('architecture', 'backend', '설계·아키텍처', 10),
  ('javascript', 'frontend', 'JavaScript', 11),
  ('typescript', 'frontend', 'TypeScript', 12),
  ('react', 'frontend', 'React', 13),
  ('browser', 'frontend', '브라우저·렌더링', 14),
  ('web-perf', 'frontend', '웹 성능', 15)
on conflict (id) do update set field = excluded.field, name = excluded.name, sort = excluded.sort;
