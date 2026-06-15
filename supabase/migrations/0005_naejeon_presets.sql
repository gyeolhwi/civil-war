-- 0005: 내전 프리셋(참가자 모집 → 웹 자동선택)
--
-- `/내전 날짜 시간` 한 번마다 프리셋 1개를 발급한다. 프리셋은 봇이 올린 모집
-- 메시지(✅ 반응으로 참가 신청)를 가리키며, 웹 "내전 시작"의 [프리셋 불러오기]가
-- 이 메시지의 ✅ 반응자를 디스코드 ID로 멤버에 매핑해 자동 선택한다.
--
-- code(번호)는 채널별·일(KST)별 순번 — 사람이 보기 쉬운 짧은 ID. 매일 1부터 다시
-- 시작하므로 전역 유일하지 않다(요구사항: 일별 초기화 허용).
--
-- ⚠️ 이 마이그레이션은 Supabase SQL Editor에 붙여 실행한다(0001~0004와 동일 방식).

create table if not exists public.match_presets (
  id                 uuid primary key default gen_random_uuid(),
  channel_id         uuid not null references public.channels(id) on delete cascade,
  code               integer not null,        -- 채널·일별 순번 (사람이 읽는 ID)
  label              text,                     -- 표시용 "날짜 시간" (예: 6/15 21:00)
  discord_channel_id text not null,           -- 모집 메시지가 올라간 디스코드 채널
  discord_message_id text not null,           -- 모집 메시지 (✅ 반응 조회 대상)
  created_at         timestamptz not null default now()
);

create index if not exists idx_match_presets_channel
  on public.match_presets(channel_id, created_at desc);

alter table public.match_presets enable row level security;

-- 소유 채널 기준 (interactions 엔드포인트는 service-role 로 RLS 우회 삽입)
create policy match_presets_all on public.match_presets for all to authenticated
  using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id));
