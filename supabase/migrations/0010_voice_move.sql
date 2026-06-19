-- 0010: 팀별 디스코드 음성채널 이동 (/내전이동)
--
-- ① channels.voice_channel_a_id / voice_channel_b_id
--    채널(=디스코드 서버)마다 A/B팀이 모일 음성채널 ID. 서버별로 다르므로 channels 행에 저장.
--    /내전이동이 guild_id → channels.discord_guild_id → 이 ID 로 이동.
-- ② matches.preset_id
--    팀 확정한 매치가 어느 모집(프리셋 #N)에서 나왔는지 연결. /내전이동 [코드] 가 #N → 최신 매치로 해석.
--    프리셋 없이 수동 시작한 매치는 NULL (코드로는 못 찾고, 코드 생략 시 최신 매치로 이동).
--
-- RLS 는 channels/matches 기존 정책(owns_channel)으로 충분. 새 정책 불필요.
-- ⚠️ Supabase SQL Editor 에서 실행. (재실행 안전)

alter table public.channels
  add column if not exists voice_channel_a_id text,
  add column if not exists voice_channel_b_id text;

alter table public.matches
  add column if not exists preset_id uuid references public.match_presets(id) on delete set null;

create index if not exists idx_matches_preset on public.matches(preset_id);
