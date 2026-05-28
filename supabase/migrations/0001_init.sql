-- Civil War 초기 스키마 (docs/erd.md 기반)
-- Supabase SQL Editor에 그대로 붙여넣어 실행.

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

-- 채널 관리자 (auth.users와 1:1)
create table public.admins (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  is_super     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 내전 채널(그룹)
create table public.channels (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  discord_channel_id text unique,
  owner_admin_id     uuid references public.admins(id) on delete restrict,
  created_at         timestamptz not null default now()
);

-- 글로벌 멤버 마스터 (배틀태그 유니크)
create table public.members (
  id           uuid primary key default gen_random_uuid(),
  battle_tag   text unique not null,
  discord_name text,
  created_at   timestamptz not null default now()
);

-- 채널 ↔ 멤버 매핑 + 기본 프로필
create table public.channel_members (
  channel_id     uuid not null references public.channels(id) on delete cascade,
  member_id      uuid not null references public.members(id) on delete cascade,
  primary_role   text check (primary_role in ('tank','dps','support')),
  secondary_role text check (secondary_role in ('tank','dps','support')),
  joined_at      timestamptz not null default now(),
  primary key (channel_id, member_id)
);

-- 채널별 역할 티어
create table public.member_role_ratings (
  channel_id   uuid not null references public.channels(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  role         text not null check (role in ('tank','dps','support')),
  tier         text not null check (tier in
                 ('bronze','silver','gold','platinum','diamond','master','grandmaster','champion')),
  division     smallint not null check (division between 1 and 5),
  rating_score integer not null,
  primary key (channel_id, member_id, role)
);

-- 채널별 선호 영웅
create table public.member_hero_preferences (
  channel_id uuid not null references public.channels(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  hero_code  text not null,
  primary key (channel_id, member_id, hero_code)
);

-- 채널별 선호 맵
create table public.member_map_preferences (
  channel_id uuid not null references public.channels(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  map_code   text not null,
  primary key (channel_id, member_id, map_code)
);

-- 한 판의 내전
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid not null references public.channels(id) on delete cascade,
  played_at     timestamptz not null default now(),
  build_mode    text not null check (build_mode in
                  ('basic','captain_top','captain_tank','captain_fun','captain_manual')),
  map_code      text,
  banned_hero_a text,
  banned_hero_b text,
  winner_side   text check (winner_side in ('A','B')),
  score_a       smallint,
  score_b       smallint,
  memo          text,
  created_at    timestamptz not null default now()
);

-- 매치당 A/B 팀
create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches(id) on delete cascade,
  side          text not null check (side in ('A','B')),
  captain_id    uuid references public.members(id) on delete set null,
  total_score   integer not null default 0,
  combo_bonus   integer not null default 0,
  combo_penalty integer not null default 0,
  final_score   integer not null default 0,
  is_winner     boolean,
  unique (match_id, side)
);

-- 팀 소속 5명
create table public.team_members (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete restrict,
  assigned_role    text not null check (assigned_role in ('tank','dps','support')),
  individual_score integer not null default 0,
  hero_used        text,
  pick_order       smallint,
  unique (team_id, member_id)
);

-- 인덱스
create index idx_channels_owner on public.channels(owner_admin_id);
create index idx_matches_channel_played on public.matches(channel_id, played_at);
create index idx_team_members_member on public.team_members(member_id);
create index idx_teams_match on public.teams(match_id);

-- ─────────────────────────────────────────────
-- 2. 헬퍼 함수
-- ─────────────────────────────────────────────

create or replace function public.is_super()
returns boolean language sql security definer stable
set search_path = public as $$
  select coalesce((select is_super from public.admins where id = auth.uid()), false);
$$;

create or replace function public.owns_channel(cid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_super() or exists (
    select 1 from public.channels
    where id = cid and owner_admin_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- 3. auth.users → admins 자동 생성 트리거
-- ─────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.admins (id, username, display_name)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────

alter table public.admins                  enable row level security;
alter table public.channels                enable row level security;
alter table public.members                 enable row level security;
alter table public.channel_members         enable row level security;
alter table public.member_role_ratings     enable row level security;
alter table public.member_hero_preferences enable row level security;
alter table public.member_map_preferences  enable row level security;
alter table public.matches                 enable row level security;
alter table public.teams                   enable row level security;
alter table public.team_members            enable row level security;

-- admins: 본인 행, 슈퍼는 전체
create policy admins_select on public.admins for select to authenticated
  using (id = auth.uid() or public.is_super());
create policy admins_update on public.admins for update to authenticated
  using (id = auth.uid() or public.is_super());

-- channels: 소유자/슈퍼
create policy channels_all on public.channels for all to authenticated
  using (public.owns_channel(id)) with check (public.owns_channel(id));

-- members: 신원 정보만 → authenticated 공유 (격리는 channel_members에서)
create policy members_select on public.members for select to authenticated using (true);
create policy members_insert on public.members for insert to authenticated with check (true);
create policy members_update on public.members for update to authenticated using (true);

-- channel_members & 프로필: 소유 채널 기준
create policy chmem_all on public.channel_members for all to authenticated
  using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id));
create policy ratings_all on public.member_role_ratings for all to authenticated
  using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id));
create policy heropref_all on public.member_hero_preferences for all to authenticated
  using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id));
create policy mappref_all on public.member_map_preferences for all to authenticated
  using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id));

-- matches: 소유 채널
create policy matches_all on public.matches for all to authenticated
  using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id));

-- teams: 매치의 채널 기준
create policy teams_all on public.teams for all to authenticated
  using (exists (select 1 from public.matches m
                 where m.id = match_id and public.owns_channel(m.channel_id)))
  with check (exists (select 1 from public.matches m
                 where m.id = match_id and public.owns_channel(m.channel_id)));

-- team_members: 팀→매치의 채널 기준
create policy teammem_all on public.team_members for all to authenticated
  using (exists (select 1 from public.teams t join public.matches m on m.id = t.match_id
                 where t.id = team_id and public.owns_channel(m.channel_id)))
  with check (exists (select 1 from public.teams t join public.matches m on m.id = t.match_id
                 where t.id = team_id and public.owns_channel(m.channel_id)));
