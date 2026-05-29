import type { Hero, Role, SubRole } from "@/domain/types";

export const ROLE_LABEL_KO: Record<Role, string> = {
  tank: "돌격",
  dps: "공격",
  support: "지원",
};

export const SUBROLE_LABEL_KO: Record<SubRole, string> = {
  brawl_tank: "브롤",
  dive_tank: "다이브",
  poke_tank: "포킹",
  main_dps: "메인딜",
  playmaker_dps: "변수딜",
  utility_dps: "유틸딜",
  main_support: "메인힐",
  utility_support: "유틸힐",
  damage_support: "공격힐",
};

/**
 * 서브유형 정규화 우선순위 (docs/requirements.md §6.3)
 * 큰 조합 패널티를 회피하는 쪽이 우선.
 */
export const SUBROLE_PRIORITY: Record<Role, SubRole[]> = {
  tank: ["brawl_tank", "poke_tank", "dive_tank"],
  dps: ["main_dps", "playmaker_dps", "utility_dps"],
  support: ["main_support", "utility_support", "damage_support"],
};

/** subRoles 배열에서 우선순위에 따라 단일 정규화 서브유형을 고른다. */
export function normalizeSubRole(role: Role, subRoles: SubRole[]): SubRole {
  for (const candidate of SUBROLE_PRIORITY[role]) {
    if (subRoles.includes(candidate)) return candidate;
  }
  return subRoles[0];
}

function hero(
  code: string,
  nameKo: string,
  role: Role,
  subRoles: SubRole[],
): Hero {
  return {
    code,
    nameKo,
    role,
    subRoles,
    normalizedSubRole: normalizeSubRole(role, subRoles),
    image: `/images/heroes/${code}.png`,
    isActive: true,
  };
}

/**
 * 영웅 마스터 (v1 코드 상수 → 추후 DB 이관, docs/requirements.md §5.4·§6)
 * 중복 표기 영웅은 subRoles 복수 → normalizedSubRole로 단일화.
 */
export const HEROES: Hero[] = [
  // ── 돌격(Tank) ──
  hero("rein", "라인하르트", "tank", ["brawl_tank"]),
  hero("zarya", "자리야", "tank", ["brawl_tank"]),
  hero("junker_queen", "정커퀸", "tank", ["brawl_tank"]),
  hero("ramattra", "라마트라", "tank", ["brawl_tank", "poke_tank"]),
  hero("mauga", "마우가", "tank", ["brawl_tank"]),
  hero("roadhog", "로드호그", "tank", ["brawl_tank"]),
  hero("winston", "윈스턴", "tank", ["dive_tank"]),
  hero("dva", "D.Va", "tank", ["dive_tank"]),
  hero("doomfist", "둠피스트", "tank", ["dive_tank"]),
  hero("wrecking_ball", "레킹볼", "tank", ["dive_tank"]),
  hero("hazard", "해저드", "tank", ["dive_tank"]),
  hero("sigma", "시그마", "tank", ["poke_tank"]),
  hero("orisa", "오리사", "tank", ["poke_tank"]),
  hero("domina", "도미나", "tank", ["poke_tank"]),

  // ── 공격(Damage) ──
  hero("soldier76", "솔저: 76", "dps", ["main_dps"]),
  hero("cassidy", "캐서디", "dps", ["main_dps"]),
  hero("ashe", "애쉬", "dps", ["main_dps"]),
  hero("sojourn", "소전", "dps", ["main_dps"]),
  hero("bastion", "바스티온", "dps", ["main_dps"]),
  hero("hanzo", "한조", "dps", ["main_dps"]),
  hero("widowmaker", "위도우메이커", "dps", ["main_dps"]),
  hero("freya", "프레야", "dps", ["main_dps"]),
  hero("tracer", "트레이서", "dps", ["playmaker_dps"]),
  hero("genji", "겐지", "dps", ["playmaker_dps"]),
  hero("sombra", "솜브라", "dps", ["playmaker_dps", "utility_dps"]),
  hero("reaper", "리퍼", "dps", ["playmaker_dps"]),
  hero("echo", "에코", "dps", ["playmaker_dps"]),
  hero("pharah", "파라", "dps", ["playmaker_dps"]),
  hero("venture", "벤처", "dps", ["playmaker_dps"]),
  hero("sierra", "시에라", "dps", ["playmaker_dps"]),
  hero("mei", "메이", "dps", ["utility_dps"]),
  hero("symmetra", "시메트라", "dps", ["utility_dps"]),
  hero("torbjorn", "토르비욘", "dps", ["utility_dps"]),
  hero("junkrat", "정크랫", "dps", ["utility_dps"]),

  // ── 지원(Support) ──
  hero("ana", "아나", "support", ["main_support", "damage_support"]),
  hero("baptiste", "바티스트", "support", ["main_support", "damage_support"]),
  hero("moira", "모이라", "support", ["main_support"]),
  hero("kiriko", "키리코", "support", ["main_support", "utility_support"]),
  hero("juno", "주노", "support", ["main_support"]),
  hero("lifeweaver", "라이프위버", "support", [
    "main_support",
    "utility_support",
  ]),
  hero("lucio", "루시우", "support", ["utility_support"]),
  hero("mercy", "메르시", "support", ["utility_support"]),
  hero("brigitte", "브리기테", "support", ["utility_support"]),
  hero("mizuki", "미즈키", "support", ["damage_support", "utility_support"]),
  hero("wuyang", "우양", "support", ["damage_support", "utility_support"]),
  hero("jetpack_cat", "제트팩 캣", "support", ["utility_support"]),
  hero("zenyatta", "젠야타", "support", ["damage_support"]),
  hero("illari", "일리아리", "support", ["damage_support"]),
];

export const HERO_BY_CODE: Record<string, Hero> = Object.fromEntries(
  HEROES.map((h) => [h.code, h]),
);

export const HERO_CODES = HEROES.map((h) => h.code);

/** 역할 표시·정렬 순서 (탱 → 딜 → 힐) */
export const ROLE_ORDER: Record<Role, number> = { tank: 0, dps: 1, support: 2 };

/** 역할별 영웅 목록 (결과 입력 시 배정 포지션 영웅만 노출용) */
export const HEROES_BY_ROLE: Record<Role, Hero[]> = {
  tank: HEROES.filter((h) => h.role === "tank"),
  dps: HEROES.filter((h) => h.role === "dps"),
  support: HEROES.filter((h) => h.role === "support"),
};

/** 이름 일부로 영웅 검색 (결과 입력 자동완성용, docs/workflow.md [11]) */
export function searchHeroes(query: string): Hero[] {
  const q = query.trim().toLowerCase();
  if (!q) return HEROES;
  return HEROES.filter(
    (h) => h.nameKo.includes(q) || h.code.toLowerCase().includes(q),
  );
}
