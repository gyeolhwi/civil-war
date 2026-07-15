-- 0011: 패치노트 디스코드 전송 (웹 → 서버 일괄/개별)
--
-- ① channels.patch_channel_id
--    패치노트가 게시될 채널(=디스코드 서버)별 텍스트채널 ID.
--    기존 discord_channel_id 는 "내전 모집 공지"용이라 용도가 다르므로 컬럼을 분리한다.
--    UNIQUE 를 걸지 않는다 — 모집 채널과 같은 채널을 지정하고 싶을 수 있고,
--    스노우플레이크는 디스코드 전역에서 이미 유일하므로 중복 방지 이득이 없다.
-- ② patch_post_sends
--    "어떤 글을 어떤 채널에 보냈는가" 이력. (post_id, channel_id) UNIQUE 로
--    일괄전송을 멱등하게 만든다(이미 보낸 서버는 건너뜀). 재전송은 upsert.
--    discord_message_ids 는 본문이 길어 여러 메시지로 쪼개진 경우까지 전부 기록한다.
--
-- RLS: 작성·열람 모두 슈퍼관리자 전용 (patch_posts 쓰기 정책과 동일 기준).
-- ⚠️ Supabase SQL Editor 에서 실행. (재실행 안전)

alter table public.channels
  add column if not exists patch_channel_id text;

create table if not exists public.patch_post_sends (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.patch_posts(id) on delete cascade,
  channel_id         uuid not null references public.channels(id) on delete cascade,
  discord_channel_id text not null,          -- 전송 시점의 채널 ID (이후 설정이 바뀌어도 이력 보존)
  discord_message_ids text[] not null default '{}',
  sent_at            timestamptz not null default now(),
  unique (post_id, channel_id)
);

create index if not exists patch_post_sends_post_idx
  on public.patch_post_sends (post_id);

alter table public.patch_post_sends enable row level security;

drop policy if exists patch_post_sends_select on public.patch_post_sends;
create policy patch_post_sends_select on public.patch_post_sends
  for select to authenticated using (public.is_super());

drop policy if exists patch_post_sends_insert on public.patch_post_sends;
create policy patch_post_sends_insert on public.patch_post_sends
  for insert to authenticated with check (public.is_super());

drop policy if exists patch_post_sends_update on public.patch_post_sends;
create policy patch_post_sends_update on public.patch_post_sends
  for update to authenticated using (public.is_super()) with check (public.is_super());

drop policy if exists patch_post_sends_delete on public.patch_post_sends;
create policy patch_post_sends_delete on public.patch_post_sends
  for delete to authenticated using (public.is_super());

-- 벙커 서버 패치노트 채널 초기 지정.
-- 채널명이 다르면 아무 행도 안 바뀌므로, 그때는 /admin 채널 설정에서 직접 입력하면 된다.
update public.channels
   set patch_channel_id = '1519184583248318534'
 where patch_channel_id is null
   and (name ilike '%벙커%' or name ilike '%bunker%');
