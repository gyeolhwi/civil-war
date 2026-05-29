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
    image: "/images/maps/busan.png",
    isActive: true,
  },
  {
    code: "ilios",
    nameKo: "일리오스",
    mode: "control",
    image: "/images/maps/ilios.png",
    isActive: true,
  },
  {
    code: "lijiang",
    nameKo: "리장 타워",
    mode: "control",
    image: "/images/maps/lijiang.png",
    isActive: true,
  },
  {
    code: "nepal",
    nameKo: "네팔",
    mode: "control",
    image: "/images/maps/nepal.png",
    isActive: true,
  },
  {
    code: "oasis",
    nameKo: "오아시스",
    mode: "control",
    image: "/images/maps/oasis.png",
    isActive: true,
  },
  {
    code: "antarctica",
    nameKo: "남극 반도",
    mode: "control",
    image: "/images/maps/antarctica.png",
    isActive: true,
  },
  // 호위(escort)
  {
    code: "circuit_royal",
    nameKo: "서킷 로얄",
    mode: "escort",
    image: "/images/maps/circuit_royal.png",
    isActive: true,
  },
  {
    code: "dorado",
    nameKo: "도라도",
    mode: "escort",
    image: "/images/maps/dorado.png",
    isActive: true,
  },
  {
    code: "route66",
    nameKo: "66번 국도",
    mode: "escort",
    image: "/images/maps/route66.png",
    isActive: true,
  },
  {
    code: "gibraltar",
    nameKo: "지브롤터",
    mode: "escort",
    image: "/images/maps/gibraltar.png",
    isActive: true,
  },
  {
    code: "junkertown",
    nameKo: "쓰레기촌",
    mode: "escort",
    image: "/images/maps/junkertown.png",
    isActive: true,
  },
  {
    code: "rialto",
    nameKo: "리알토",
    mode: "escort",
    image: "/images/maps/rialto.png",
    isActive: true,
  },
  {
    code: "shambali",
    nameKo: "샴발리 수도원",
    mode: "escort",
    image: "/images/maps/shambali.png",
    isActive: true,
  },
  // 혼합(hybrid)
  {
    code: "kings_row",
    nameKo: "왕의 길",
    mode: "hybrid",
    image: "/images/maps/kings_row.png",
    isActive: true,
  },
  {
    code: "midtown",
    nameKo: "미드타운",
    mode: "hybrid",
    image: "/images/maps/midtown.png",
    isActive: true,
  },
  {
    code: "numbani",
    nameKo: "눔바니",
    mode: "hybrid",
    image: "/images/maps/numbani.png",
    isActive: true,
  },
  {
    code: "paraiso",
    nameKo: "파라이수",
    mode: "hybrid",
    image: "/images/maps/paraiso.png",
    isActive: true,
  },
  {
    code: "hollywood",
    nameKo: "할리우드",
    mode: "hybrid",
    image: "/images/maps/hollywood.png",
    isActive: true,
  },
  {
    code: "eichenwalde",
    nameKo: "아이헨발데",
    mode: "hybrid",
    image: "/images/maps/eichenwalde.png",
    isActive: true,
  },
  // 밀기(push)
  {
    code: "colosseo",
    nameKo: "콜로세오",
    mode: "push",
    image: "/images/maps/colosseo.png",
    isActive: true,
  },
  {
    code: "esperanca",
    nameKo: "에스페란사",
    mode: "push",
    image: "/images/maps/esperanca.png",
    isActive: true,
  },
  {
    code: "new_queen_street",
    nameKo: "뉴 퀸 스트리트",
    mode: "push",
    image: "/images/maps/new_queen_street.png",
    isActive: true,
  },
  {
    code: "runasapi",
    nameKo: "루나사피",
    mode: "push",
    image: "/images/maps/runasapi.png",
    isActive: true,
  },
  // 플래시포인트(flashpoint)
  {
    code: "new_junk_city",
    nameKo: "뉴 정크 시티",
    mode: "flashpoint",
    image: "/images/maps/new_junk_city.png",
    isActive: true,
  },
  {
    code: "suravasa",
    nameKo: "수라바사",
    mode: "flashpoint",
    image: "/images/maps/suravasa.png",
    isActive: true,
  },
  // 격돌(clash)
  {
    code: "hanaoka",
    nameKo: "하나오카",
    mode: "clash",
    image: "/images/maps/hanaoka.png",
    isActive: false,
  },
  {
    code: "throne_of_anubis",
    nameKo: "아누비스 왕좌",
    mode: "clash",
    image: "/images/maps/throne_of_anubis.png",
    isActive: false,
  },
];

export const MAP_BY_CODE: Record<string, GameMap> = Object.fromEntries(
  MAPS.map((m) => [m.code, m]),
);

export const MAP_CODES = MAPS.map((m) => m.code);
