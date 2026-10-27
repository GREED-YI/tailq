-- 앱 안 피드백(#101): 하루 한도, 사용자 권한으로는 읽지도 쓰지도 못하고, 탈퇴하면 같이 지워진다
begin;
select plan(7);

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"name": "에이"}');
insert into public.feedback (user_id, body) values
  ('00000000-0000-0000-0000-00000000000a', '복습 알림 시각을 고르고 싶어요');

select throws_ok(
  $$insert into public.feedback (user_id, body) values ('00000000-0000-0000-0000-00000000000a', '  짧음 ')$$,
  '23514', null, '앞뒤 공백을 뺀 본문이 5자보다 짧으면 저장하지 않는다'
);

-- 24시간 한도까지만 넣는다(이미 1개 있으니 2개 한도면 하나 더, 그다음은 막힌다)
select lives_ok(
  $$select public.send_feedback('00000000-0000-0000-0000-00000000000a', '한도 안의 두 번째 의견', 2)$$,
  '한도 안이면 넣는다'
);
select throws_ok(
  $$select public.send_feedback('00000000-0000-0000-0000-00000000000a', '한도를 넘는 세 번째 의견', 2)$$,
  'FEEDBACK_LIMIT', '24시간 한도를 넘으면 넣지 않는다'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is_empty(
  $$select id from public.feedback$$,
  '보낸 사람도 자기 피드백을 읽지 못한다'
);
select throws_ok(
  $$insert into public.feedback (user_id, body) values ('00000000-0000-0000-0000-00000000000a', '직접 넣어 볼게요')$$,
  '42501', null, '사용자 권한으로는 피드백을 넣지 못한다'
);

reset role;
set local role anon;
select is_empty(
  $$select id from public.feedback$$,
  '로그인하지 않으면 피드백을 읽지 못한다'
);

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is_empty(
  $$select id from public.feedback where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '탈퇴하면 피드백도 지워진다'
);

select * from finish();
rollback;
