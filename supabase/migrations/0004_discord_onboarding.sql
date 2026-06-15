-- 0004: 디스코드 온보딩(/등록) 연동 키
--
-- 봇 슬래시 커맨드 `/등록`으로 디스코드 안에서 멤버를 등록/수정하기 위한 최소 키 2개.
--   · members.discord_user_id : 디스코드 계정 ↔ 글로벌 멤버 연결 (재실행 시 본인 행을 찾아 수정)
--   · channels.discord_guild_id : 길드(디스코드 서버) ↔ 내전 채널 1:1 매핑
--     (디스코드에서 온 요청엔 웹 세션이 없으므로 guild_id 로 어느 채널에 등록할지 정한다)
--
-- ⚠️ 이 마이그레이션은 Supabase SQL Editor에 붙여 실행한다(0001~0003과 동일 방식).
-- (재실행 안전: add column if not exists)

alter table public.members
  add column if not exists discord_user_id text unique;

alter table public.channels
  add column if not exists discord_guild_id text unique;
