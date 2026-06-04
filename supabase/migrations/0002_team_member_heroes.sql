-- 0002: team_members 영웅 다중 기록
-- 한 판에 영웅을 바꿔 가며 플레이하므로 단일 hero_used → 배열 heroes_used 로 확장.
-- 라이브 안전: 신규 컬럼 추가 + 기존 값 백필. 기존 hero_used 는 남겨둠(후속 마이그레이션에서 드롭).

alter table public.team_members
  add column if not exists heroes_used text[] not null default '{}';

-- 기존 단일 영웅 값을 배열로 백필 (NULL 은 빈 배열 유지)
update public.team_members
  set heroes_used = array[hero_used]
  where hero_used is not null
    and heroes_used = '{}';
