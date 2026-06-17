-- 0006: 신규 영웅 시온 · 신규 맵 네온 정션 추가
--
-- 0003(hero_map_master)의 글로벌 영웅·맵 마스터에 콘텐츠 1건씩 추가한다.
-- 이미지는 code 파생 규칙(`/images/{heroes,maps}/${code}.{png,jpg}`)을 따르며,
-- 파일은 이미 배치됨: public/images/heroes/shion.png, public/images/maps/neon_junction.jpg
--
-- sort_order는 각 그룹(역할·모드)의 "맨 뒤"로 부여해 기존 정렬을 건드리지 않는다.
--   · shion: dps 중 가장 큰 sort_order(52) → DPS 목록 끝에 표시
--   · neon_junction: hybrid 끝(32) → 하이브리드 목록 끝에 표시
-- 분류: 시온 = 암살형 서브딜러 → role=dps, comp={dive}, func={flanker}
--       네온 정션 = 하이브리드(hybrid)
--
-- on conflict: 0003과 동일하게 재실행 안전(idempotent).
-- 적용 후 ref-data 캐시(unstable_cache tag "ref-data", revalidate 3600s)가
-- 만료되거나 revalidateTag("ref-data") 호출 시 웹앱에 반영된다(최대 ~1시간).

insert into public.heroes (code, name_ko, role, comp, func, is_active, sort_order) values
  ('shion', '시온', 'dps', '{dive}', '{flanker}', true, 52)
on conflict (code) do nothing;

insert into public.maps (code, name_ko, mode, is_active, sort_order) values
  ('neon_junction', '네온 정션', 'hybrid', true, 32)
on conflict (code) do nothing;
