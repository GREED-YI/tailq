-- 테이블·뷰를 새로 만들 때 RLS를 빠뜨리지 않게 public 스키마 전체를 본다(docs/10 보안 점검 "인증·권한").
-- 브라우저 권한(anon·authenticated)은 읽기 정책만 갖고, 쓰기는 모두 service_role의 서버 함수가 한다.
begin;
select plan(4);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  0::bigint,
  'public 테이블은 모두 RLS가 켜져 있다'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and cmd <> 'SELECT'),
  0::bigint,
  '정책은 읽기뿐이다(브라우저 권한으로 쓰는 길이 없다)'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and roles && array['anon', 'public']::name[]
  ),
  0::bigint,
  '로그인하지 않은 사람에게 열린 정책이 없다'
);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any(c.reloptions), false)
  ),
  0::bigint,
  'public 뷰는 모두 security_invoker라 읽는 사람의 RLS를 따른다'
);

select * from finish();
rollback;
