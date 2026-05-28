-- Civil War 시드 — 마이그레이션(0001_init.sql) 실행 후,
-- 그리고 대시보드 Authentication에서 관리자 계정을 만든 뒤 실행한다.
--
-- [관리자 계정 만드는 법]
--   Supabase 대시보드 → Authentication → Users → Add user
--     Email: admin@civilwar.local   (아이디가 'admin'이 됨)
--     Password: (원하는 비밀번호)
--     ✅ Auto Confirm User 체크
--   → on_auth_user_created 트리거가 public.admins 행을 자동 생성 (username='admin')
--
-- 아래 'admin'을 실제로 만든 username으로 바꿔서 실행.

-- 1) 첫 관리자를 슈퍼관리자로 승격
update public.admins set is_super = true where username = 'admin';

-- 2) 테스트 채널 생성 + 소유자 연결
insert into public.channels (name, owner_admin_id)
select '테스트 내전 채널', a.id
from public.admins a
where a.username = 'admin'
  and not exists (
    select 1 from public.channels c where c.owner_admin_id = a.id
  );

-- 확인
select a.username, a.is_super, c.name as channel
from public.admins a
left join public.channels c on c.owner_admin_id = a.id;
