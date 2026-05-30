import type { GameMap, GameMode } from "@/domain/types";

export const MODE_LABEL_KO: Record<GameMode, string> = {
  control: "점령",
  escort: "호위",
  hybrid: "혼합",
  push: "밀기",
  flashpoint: "플래시포인트",
  clash: "격돌",
};

/**
 * 맵 마스터 (v1 코드 상수 → 추후 DB 이관, docs/requirements.md §5.4)
 * shape을 미래 `maps` 테이블과 1:1 대응.
 */
export const MAPS: GameMap[] = [
  // 점령(control)
  {
    code: "busan",
    nameKo: "부산",
    mode: "control",
    image: "/images/maps/busan.jpg",
    isActive: true,
  },
  {
    code: "ilios",
    nameKo: "일리오스",
    mode: "control",
    image: "/images/maps/ilios.jpg",
    isActive: true,
  },
  {
    code: "lijiang",
    nameKo: "리장 타워",
    mode: "control",
    image: "/images/maps/lijiang.jpg",
    isActive: true,
  },
  {
    code: "nepal",
    nameKo: "네팔",
    mode: "control",
    image: "/images/maps/nepal.jpg",
    isActive: true,
  },
  {
    code: "oasis",
    nameKo: "오아시스",
    mode: "control",
    image: "/images/maps/oasis.jpg",
    isActive: true,
  },
  {
    code: "antarctica",
    nameKo: "남극 반도",
    mode: "control",
    image: "/images/maps/antarctica.jpg",
    isActive: true,
  },
  {
    code: "samoa",
    nameKo: "사모아",
    mode: "control",
    image: "/images/maps/samoa.jpg",
    isActive: true,
  },
  // 호위(escort)
  {
    code: "circuit_royal",
    nameKo: "서킷 로얄",
    mode: "escort",
    image: "/images/maps/circuit_royal.jpg",
    isActive: true,
  },
  {
    code: "dorado",
    nameKo: "도라도",
    mode: "escort",
    image: "/images/maps/dorado.jpg",
    isActive: true,
  },
  {
    code: "route66",
    nameKo: "66번 국도",
    mode: "escort",
    image: "/images/maps/route66.jpg",
    isActive: true,
  },
  {
    code: "gibraltar",
    nameKo: "지브롤터",
    mode: "escort",
    image: "/images/maps/gibraltar.jpg",
    isActive: true,
  },
  {
    code: "junkertown",
    nameKo: "쓰레기촌",
    mode: "escort",
    image: "/images/maps/junkertown.jpg",
    isActive: true,
  },
  {
    code: "rialto",
    nameKo: "리알토",
    mode: "escort",
    image: "/images/maps/rialto.jpg",
    isActive: true,
  },
  {
    code: "shambali",
    nameKo: "샴발리 수도원",
    mode: "escort",
    image: "/images/maps/shambali.jpg",
    isActive: true,
  },
  {
    code: "havana",
    nameKo: "하바나",
    mode: "escort",
    image: "/images/maps/havana.jpg",
    isActive: true,
  },
  // 혼합(hybrid)
  {
    code: "kings_row",
    nameKo: "왕의 길",
    mode: "hybrid",
    image: "/images/maps/kings_row.jpg",
    isActive: true,
  },
  {
    code: "midtown",
    nameKo: "미드타운",
    mode: "hybrid",
    image: "/images/maps/midtown.jpg",
    isActive: true,
  },
  {
    code: "numbani",
    nameKo: "눔바니",
    mode: "hybrid",
    image: "/images/maps/numbani.jpg",
    isActive: true,
  },
  {
    code: "paraiso",
    nameKo: "파라이수",
    mode: "hybrid",
    image: "/images/maps/paraiso.jpg",
    isActive: true,
  },
  {
    code: "hollywood",
    nameKo: "할리우드",
    mode: "hybrid",
    image: "/images/maps/hollywood.jpg",
    isActive: true,
  },
  {
    code: "eichenwalde",
    nameKo: "아이헨발데",
    mode: "hybrid",
    image: "/images/maps/eichenwalde.jpg",
    isActive: true,
  },
  {
    code: "blizzard_world",
    nameKo: "블리자드 월드",
    mode: "hybrid",
    image: "/images/maps/blizzard_world.jpg",
    isActive: true,
  },
  // 밀기(push)
  {
    code: "colosseo",
    nameKo: "콜로세오",
    mode: "push",
    image: "/images/maps/colosseo.jpg",
    isActive: true,
  },
  {
    code: "esperanca",
    nameKo: "에스페란사",
    mode: "push",
    image: "/images/maps/esperanca.jpg",
    isActive: true,
  },
  {
    code: "new_queen_street",
    nameKo: "뉴 퀸 스트리트",
    mode: "push",
    image: "/images/maps/new_queen_street.jpg",
    isActive: true,
  },
  {
    code: "runasapi",
    nameKo: "루나사피",
    mode: "push",
    image: "/images/maps/runasapi.jpg",
    isActive: true,
  },
  // 플래시포인트(flashpoint)
  {
    code: "new_junk_city",
    nameKo: "뉴 정크 시티",
    mode: "flashpoint",
    image: "/images/maps/new_junk_city.jpg",
    isActive: true,
  },
  {
    code: "suravasa",
    nameKo: "수라바사",
    mode: "flashpoint",
    image: "/images/maps/suravasa.jpg",
    isActive: true,
  },
  {
    code: "aatlis",
    nameKo: "아틀리스",
    mode: "flashpoint",
    image: "/images/maps/aatlis.jpg",
    isActive: true,
  },
  // 격돌(clash)
  {
    code: "hanaoka",
    nameKo: "하나오카",
    mode: "clash",
    image: "/images/maps/hanaoka.jpg",
    isActive: false,
  },
  {
    code: "throne_of_anubis",
    nameKo: "아누비스 왕좌",
    mode: "clash",
    image: "/images/maps/throne_of_anubis.jpg",
    isActive: false,
  },
];

export const MAP_BY_CODE: Record<string, GameMap> = Object.fromEntries(
  MAPS.map((m) => [m.code, m]),
);

export const MAP_CODES = MAPS.map((m) => m.code);
