`-- 0008: 디스코드 ID를 "채널별"로 멤버에 연결 허용
--
-- 같은 디스코드 계정이 채널마다 다른 배틀태그(멤버)로 활동할 수 있어야 한다
-- (예: 비숑=배틀태그 A, 벙커=배틀태그 B). 0004에서 건 전역 UNIQUE 제약은
-- "디스코드 계정 1개 = 전역 멤버 1개"를 강제해 이 경우를 막으므로 제거한다.
--
-- 채널 내 중복(한 채널에서 같은 디스코드 ID가 두 멤버에 연결)은 앱 로직에서 차단:
--   · 디스코드 /내전-프로필: resolveMemberId 를 채널 단위로 조회
--   · 관리자 연결(setMemberDiscordId): 같은 채널 내 중복 검사
--
-- ⚠️ Supabase SQL Editor에서 실행. (재실행 안전)

alter table public.members
  drop constraint if exists members_discord_user_id_key;

create index if not exists members_discord_user_id_idx
  on public.members (discord_user_id);
`