-- 0009: 채널별 내전 규칙
--
-- 규칙은 채널마다 다를 수 있다. 기본 템플릿은 코드 상수(DEFAULT_RULES_MD)를 쓰고,
-- 채널이 직접 수정하면 이 테이블에 행이 생긴다(없으면 기본 템플릿 표시).
-- 읽기·쓰기 모두 owns_channel — 채널 소유 관리자(+슈퍼)만. (관리자 전용)
--
-- ⚠️ Supabase SQL Editor에서 실행. (재실행 안전)

create table if not exists public.channel_rules (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  body       text not null,
  updated_at timestamptz not null default now()
);

alter table public.channel_rules enable row level security;

drop policy if exists channel_rules_rw on public.channel_rules;
create policy channel_rules_rw on public.channel_rules
  for all to authenticated
  using (public.owns_channel(channel_id))
  with check (public.owns_channel(channel_id));

drop trigger if exists channel_rules_set_updated_at on public.channel_rules;
create trigger channel_rules_set_updated_at
  before update on public.channel_rules
  for each row execute function public.set_updated_at();
