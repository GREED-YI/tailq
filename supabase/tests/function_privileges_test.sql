-- public 스키마의 DB 함수는 service_role만 실행한다. 브라우저(anon·authenticated)가
-- rpc()로 부를 수 있는 함수가 하나라도 생기면 실패한다(08 설계 "함수 권한은 명시적으로 닫는다").
begin;
select plan(1);

select is(
  (
    select count(*)
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and privilege_type = 'EXECUTE'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  0::bigint,
  'anon·authenticated가 실행할 수 있는 public 함수가 없다'
);

select * from finish();
rollback;
