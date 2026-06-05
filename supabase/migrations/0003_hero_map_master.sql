-- 0003: 영웅·맵 마스터 DB 이관 (docs/discussion/balancing-data-review.md 결정 반영)
--
-- 결정 요약:
--   · 경계선 = "영웅·맵별 속성 = DB / 알고리즘 튜닝 상수 = 코드"
--   · 영웅 comp/func(밸런싱 분류)도 영웅에 귀속된 데이터이므로 DB로 이관(전체 이관).
--   · COMBO_PENALTY·PREFERENCE_WEIGHT·TIER_BASE 등 튜닝 상수는 코드(src/domain)에 유지.
--   · 맵풀(is_active)은 글로벌. image는 컬럼 안 두고 code 파생 규칙 유지(`/images/{heroes,maps}/${code}.{png,jpg}`).
--
-- ⚠️ 이 마이그레이션은 Supabase SQL Editor에 붙여 실행한다(0001·0002와 동일 방식).
--
-- ── 실행 후 코드 작업 (이 SQL만으로는 끝이 아님) ───────────────────────────
--   [ ] 1. 로드+검증 계층: heroes/maps 테이블 → 타입 객체(Hero[]/GameMap[])로 파싱.
--          Role/Comp/HeroFunc/GameMode 유니온은 코드 유지, DB는 text만 저장.
--          enum 위반·comp 길이 위반이면 조용히 무시 말고 throw(런타임 검증).
--   [ ] 2. 쓰기 검증(관리자 편집 경로): Zod 스키마로 comp ∈ {dive,brawl,poke} 1~2개,
--          func는 역할별 허용치만, role/mode enum 강제.
--   [ ] 3. team-builder.ts 리팩터: HERO_BY_CODE 동기 참조(ownedFor) → 로드된 heroMap 주입.
--          순수함수는 유지, 데이터 출처만 교체. team-builder 테스트는 주입 패턴으로 수정.
--          (scoring.test.ts는 인라인 fixture라 영향 없음)
--   [ ] 4. 기존 상수(src/constants/heroes.ts·maps.ts) 사용처를 로더로 교체 후 상수 제거/축소.
--          ROLE_LABEL_KO·COMP_LABEL_KO·FUNC_LABEL_KO·MODE_LABEL_KO 라벨은 코드 유지(표시용).
--   [ ] 5. (선택) 슈퍼관리자용 영웅/맵 편집 UI. 없으면 당분간 SQL Editor로 운영.
-- ──────────────────────────────────────────────────────────────────────────

-- (재실행 안전: create if not exists / drop policy if exists / on conflict do nothing /
--  create or replace trigger — 같은 SQL을 다시 붙여 넣어도 에러 없이 idempotent)

-- ─────────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────────

-- 영웅 마스터 (글로벌 콘텐츠). comp=조합 성향, func=역할 내 기능.
create table if not exists public.heroes (
  code       text primary key,
  name_ko    text not null,
  role       text not null check (role in ('tank','dps','support')),
  comp       text[] not null,            -- {dive,brawl,poke} 1~2개 (쓰기 시 앱에서 Zod 검증)
  func       text[] not null default '{}', -- 탱커는 빈 배열
  is_active  boolean not null default true,
  sort_order integer not null default 0,  -- 표시·정렬 순서(현재 배열 순서 보존)
  updated_at timestamptz not null default now()
);

-- 맵 마스터 (글로벌 콘텐츠). is_active = 시즌 맵풀 로테이션.
create table if not exists public.maps (
  code       text primary key,
  name_ko    text not null,
  mode       text not null check (mode in ('control','escort','hybrid','push','flashpoint','clash')),
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. updated_at 자동 갱신 트리거 (편집 이력)
-- ─────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger heroes_set_updated_at
  before update on public.heroes
  for each row execute function public.set_updated_at();
create or replace trigger maps_set_updated_at
  before update on public.maps
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- 3. RLS — 읽기 공개(anon 포함, /record 공개 페이지용), 쓰기 슈퍼관리자만
-- ─────────────────────────────────────────────

alter table public.heroes enable row level security;
alter table public.maps   enable row level security;

-- 읽기: 누구나(공개 레퍼런스 데이터)
drop policy if exists heroes_select on public.heroes;
create policy heroes_select on public.heroes for select using (true);
drop policy if exists maps_select on public.maps;
create policy maps_select on public.maps for select using (true);

-- 쓰기: 슈퍼관리자만 (글로벌 콘텐츠)
drop policy if exists heroes_insert on public.heroes;
create policy heroes_insert on public.heroes for insert to authenticated with check (public.is_super());
drop policy if exists heroes_update on public.heroes;
create policy heroes_update on public.heroes for update to authenticated using (public.is_super()) with check (public.is_super());
drop policy if exists heroes_delete on public.heroes;
create policy heroes_delete on public.heroes for delete to authenticated using (public.is_super());

drop policy if exists maps_insert on public.maps;
create policy maps_insert on public.maps for insert to authenticated with check (public.is_super());
drop policy if exists maps_update on public.maps;
create policy maps_update on public.maps for update to authenticated using (public.is_super()) with check (public.is_super());
drop policy if exists maps_delete on public.maps;
create policy maps_delete on public.maps for delete to authenticated using (public.is_super());

-- ─────────────────────────────────────────────
-- 4. 시드 — 현재 코드 상수(heroes.ts / maps.ts)의 baseline. git에 박아 재현·리뷰 가능.
--    on conflict do nothing → 재실행해도 중복 에러 없음.
-- ─────────────────────────────────────────────

insert into public.heroes (code, name_ko, role, comp, func, is_active, sort_order) values
  -- 돌격(Tank) — func 없음
  ('rein',          '라인하르트',     'tank', '{brawl}',       '{}', true,  1),
  ('zarya',         '자리야',         'tank', '{brawl}',       '{}', true,  2),
  ('junker_queen',  '정커퀸',         'tank', '{brawl}',       '{}', true,  3),
  ('ramattra',      '라마트라',       'tank', '{brawl,poke}',  '{}', true,  4),
  ('mauga',         '마우가',         'tank', '{brawl}',       '{}', true,  5),
  ('roadhog',       '로드호그',       'tank', '{brawl}',       '{}', true,  6),
  ('winston',       '윈스턴',         'tank', '{dive}',        '{}', true,  7),
  ('dva',           'D.Va',           'tank', '{dive}',        '{}', true,  8),
  ('doomfist',      '둠피스트',       'tank', '{dive}',        '{}', true,  9),
  ('wrecking_ball', '레킹볼',         'tank', '{dive}',        '{}', true, 10),
  ('hazard',        '해저드',         'tank', '{dive}',        '{}', true, 11),
  ('sigma',         '시그마',         'tank', '{poke}',        '{}', true, 12),
  ('orisa',         '오리사',         'tank', '{poke,brawl}',  '{}', true, 13),
  ('domina',        '도미나',         'tank', '{poke,brawl}',  '{}', true, 14),
  -- 공격(Damage) — comp + func
  ('soldier76',   '솔저: 76',     'dps', '{poke,brawl}', '{hitscan}',         true, 15),
  ('cassidy',     '캐서디',       'dps', '{brawl}',      '{hitscan}',         true, 16),
  ('ashe',        '애쉬',         'dps', '{poke}',       '{hitscan}',         true, 17),
  ('sojourn',     '소전',         'dps', '{poke}',       '{hitscan}',         true, 18),
  ('bastion',     '바스티온',     'dps', '{poke,brawl}', '{hitscan}',         true, 19),
  ('hanzo',       '한조',         'dps', '{poke}',       '{projectile}',      true, 20),
  ('widowmaker',  '위도우메이커', 'dps', '{poke}',       '{hitscan}',         true, 21),
  ('freya',       '프레야',       'dps', '{dive}',       '{projectile}',      true, 22),
  ('emre',        '엠레',         'dps', '{poke}',       '{hitscan}',         true, 23),
  ('tracer',      '트레이서',     'dps', '{dive}',       '{flanker}',         true, 24),
  ('genji',       '겐지',         'dps', '{dive}',       '{flanker}',         true, 25),
  ('sombra',      '솜브라',       'dps', '{dive}',       '{flanker}',         true, 26),
  ('reaper',      '리퍼',         'dps', '{brawl}',      '{flanker}',         true, 27),
  ('echo',        '에코',         'dps', '{dive}',       '{projectile}',      true, 28),
  ('pharah',      '파라',         'dps', '{poke}',       '{projectile}',      true, 29),
  ('venture',     '벤처',         'dps', '{dive,brawl}', '{projectile}',      true, 30),
  ('sierra',      '시에라',       'dps', '{dive}',       '{flanker,hitscan}', true, 31),
  ('anran',       '안란',         'dps', '{poke}',       '{flanker,sub}',     true, 32),
  ('vendetta',    '벤데타',       'dps', '{dive}',       '{sub}',             true, 33),
  ('mei',         '메이',         'dps', '{brawl}',      '{sub}',             true, 34),
  ('symmetra',    '시메트라',     'dps', '{poke,brawl}', '{sub}',             true, 35),
  ('torbjorn',    '토르비욘',     'dps', '{brawl,poke}', '{sub}',             true, 36),
  ('junkrat',     '정크랫',       'dps', '{brawl}',      '{sub}',             true, 37),
  -- 지원(Support) — comp + func
  ('ana',         '아나',         'support', '{poke}',       '{main_heal}', true, 38),
  ('baptiste',    '바티스트',     'support', '{poke,brawl}', '{main_heal}', true, 39),
  ('moira',       '모이라',       'support', '{brawl,dive}', '{main_heal}', true, 40),
  ('kiriko',      '키리코',       'support', '{dive,brawl}', '{main_heal}', true, 41),
  ('juno',        '주노',         'support', '{dive,poke}',  '{main_heal}', true, 42),
  ('lifeweaver',  '라이프위버',   'support', '{brawl}',      '{main_heal}', true, 43),
  ('lucio',       '루시우',       'support', '{dive,brawl}', '{off_heal}',  true, 44),
  ('mercy',       '메르시',       'support', '{dive}',       '{off_heal}',  true, 45),
  ('brigitte',    '브리기테',     'support', '{brawl}',      '{off_heal}',  true, 46),
  ('mizuki',      '미즈키',       'support', '{brawl}',      '{off_heal}',  true, 47),
  ('wuyang',      '우양',         'support', '{poke}',       '{damage}',    true, 48),
  ('jetpack_cat', '제트팩 캣',    'support', '{dive}',       '{off_heal}',  true, 49),
  ('zenyatta',    '젠야타',       'support', '{poke}',       '{damage}',    true, 50),
  ('illari',      '일리아리',     'support', '{poke}',       '{damage}',    true, 51)
on conflict (code) do nothing;

insert into public.maps (code, name_ko, mode, is_active, sort_order) values
  -- 점령(control)
  ('busan',            '부산',          'control',    true,  1),
  ('ilios',            '일리오스',      'control',    true,  2),
  ('lijiang',          '리장 타워',     'control',    true,  3),
  ('nepal',            '네팔',          'control',    true,  4),
  ('oasis',            '오아시스',      'control',    true,  5),
  ('antarctica',       '남극 반도',     'control',    true,  6),
  ('samoa',            '사모아',        'control',    true,  7),
  -- 호위(escort)
  ('circuit_royal',    '서킷 로얄',     'escort',     true,  8),
  ('dorado',           '도라도',        'escort',     true,  9),
  ('route66',          '66번 국도',     'escort',     true, 10),
  ('gibraltar',        '지브롤터',      'escort',     true, 11),
  ('junkertown',       '쓰레기촌',      'escort',     true, 12),
  ('rialto',           '리알토',        'escort',     true, 13),
  ('shambali',         '샴발리 수도원', 'escort',     true, 14),
  ('havana',           '하바나',        'escort',     true, 15),
  -- 혼합(hybrid)
  ('kings_row',        '왕의 길',       'hybrid',     true, 16),
  ('midtown',          '미드타운',      'hybrid',     true, 17),
  ('numbani',          '눔바니',        'hybrid',     true, 18),
  ('paraiso',          '파라이수',      'hybrid',     true, 19),
  ('hollywood',        '할리우드',      'hybrid',     true, 20),
  ('eichenwalde',      '아이헨발데',    'hybrid',     true, 21),
  ('blizzard_world',   '블리자드 월드', 'hybrid',     true, 22),
  -- 밀기(push)
  ('colosseo',         '콜로세오',      'push',       true, 23),
  ('esperanca',        '에스페란사',    'push',       true, 24),
  ('new_queen_street', '뉴 퀸 스트리트','push',       true, 25),
  ('runasapi',         '루나사피',      'push',       true, 26),
  -- 플래시포인트(flashpoint)
  ('new_junk_city',    '뉴 정크 시티',  'flashpoint', true, 27),
  ('suravasa',         '수라바사',      'flashpoint', true, 28),
  ('aatlis',           '아틀리스',      'flashpoint', true, 29),
  -- 격돌(clash) — 현재 비활성
  ('hanaoka',          '하나오카',      'clash',      false, 30),
  ('throne_of_anubis', '아누비스 왕좌', 'clash',      false, 31)
on conflict (code) do nothing;
