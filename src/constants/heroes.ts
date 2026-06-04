import type { Comp, Hero, HeroFunc, Role } from "@/domain/types";

export const ROLE_LABEL_KO: Record<Role, string> = {
  tank: "돌격",
  dps: "공격",
  support: "지원",
};

/** 조합 성향 라벨 */
export const COMP_LABEL_KO: Record<Comp, string> = {
  dive: "다이브",
  brawl: "브롤",
  poke: "포킹",
};

/** 역할 내 기능 라벨 */
export const FUNC_LABEL_KO: Record<HeroFunc, string> = {
  hitscan: "히트스캔",
  flanker: "플랭커",
  projectile: "투사체",
  sub: "유틸딜",
  main_heal: "메인힐",
  off_heal: "보조힐",
  damage: "공격힐",
};

function hero(
  code: string,
  nameKo: string,
  role: Role,
  comp: Comp[],
  func: HeroFunc[] = [],
): Hero {
  return {
    code,
    nameKo,
    role,
    comp,
    func,
    image: `/images/heroes/${code}.png`,
    isActive: true,
  };
}

/**
 * 영웅 마스터 (v1 코드 상수).
 * comp(조합 성향) + func(역할 기능). 탱커는 func 없음(comp가 곧 기능).
 * 분류 근거·검수 이력: docs/discussion/hero-classification.md
 */
export const HEROES: Hero[] = [
  // ── 돌격(Tank) ──
  hero("rein", "라인하르트", "tank", ["brawl"]),
  hero("zarya", "자리야", "tank", ["brawl"]),
  hero("junker_queen", "정커퀸", "tank", ["brawl"]),
  hero("ramattra", "라마트라", "tank", ["brawl", "poke"]),
  hero("mauga", "마우가", "tank", ["brawl"]),
  hero("roadhog", "로드호그", "tank", ["brawl"]),
  hero("winston", "윈스턴", "tank", ["dive"]),
  hero("dva", "D.Va", "tank", ["dive"]),
  hero("doomfist", "둠피스트", "tank", ["dive"]),
  hero("wrecking_ball", "레킹볼", "tank", ["dive"]),
  hero("hazard", "해저드", "tank", ["dive"]),
  hero("sigma", "시그마", "tank", ["poke"]),
  hero("orisa", "오리사", "tank", ["poke", "brawl"]),
  hero("domina", "도미나", "tank", ["poke", "brawl"]),

  // ── 공격(Damage) ──
  hero("soldier76", "솔저: 76", "dps", ["poke", "brawl"], ["hitscan"]),
  hero("cassidy", "캐서디", "dps", ["brawl"], ["hitscan"]),
  hero("ashe", "애쉬", "dps", ["poke"], ["hitscan"]),
  hero("sojourn", "소전", "dps", ["poke"], ["hitscan"]),
  hero("bastion", "바스티온", "dps", ["poke", "brawl"], ["hitscan"]),
  hero("hanzo", "한조", "dps", ["poke"], ["projectile"]),
  hero("widowmaker", "위도우메이커", "dps", ["poke"], ["hitscan"]),
  hero("freya", "프레야", "dps", ["dive"], ["projectile"]),
  hero("emre", "엠레", "dps", ["poke"], ["hitscan"]),
  hero("tracer", "트레이서", "dps", ["dive"], ["flanker"]),
  hero("genji", "겐지", "dps", ["dive"], ["flanker"]),
  hero("sombra", "솜브라", "dps", ["dive"], ["flanker"]),
  hero("reaper", "리퍼", "dps", ["brawl"], ["flanker"]),
  hero("echo", "에코", "dps", ["dive"], ["projectile"]),
  hero("pharah", "파라", "dps", ["poke"], ["projectile"]),
  hero("venture", "벤처", "dps", ["dive", "brawl"], ["projectile"]),
  hero("sierra", "시에라", "dps", ["dive"], ["flanker", "hitscan"]),
  hero("anran", "안란", "dps", ["poke"], ["flanker", "sub"]),
  hero("vendetta", "벤데타", "dps", ["dive"], ["sub"]),
  hero("mei", "메이", "dps", ["brawl"], ["sub"]),
  hero("symmetra", "시메트라", "dps", ["poke", "brawl"], ["sub"]),
  hero("torbjorn", "토르비욘", "dps", ["brawl", "poke"], ["sub"]),
  hero("junkrat", "정크랫", "dps", ["brawl"], ["sub"]),

  // ── 지원(Support) ──
  hero("ana", "아나", "support", ["poke"], ["main_heal"]),
  hero("baptiste", "바티스트", "support", ["poke", "brawl"], ["main_heal"]),
  hero("moira", "모이라", "support", ["brawl", "dive"], ["main_heal"]),
  hero("kiriko", "키리코", "support", ["dive", "brawl"], ["main_heal"]),
  hero("juno", "주노", "support", ["dive", "poke"], ["main_heal"]),
  hero("lifeweaver", "라이프위버", "support", ["brawl"], ["main_heal"]),
  hero("lucio", "루시우", "support", ["dive", "brawl"], ["off_heal"]),
  hero("mercy", "메르시", "support", ["dive"], ["off_heal"]),
  hero("brigitte", "브리기테", "support", ["brawl"], ["off_heal"]),
  hero("mizuki", "미즈키", "support", ["brawl"], ["off_heal"]),
  hero("wuyang", "우양", "support", ["poke"], ["damage"]),
  hero("jetpack_cat", "제트팩 캣", "support", ["dive"], ["off_heal"]),
  hero("zenyatta", "젠야타", "support", ["poke"], ["damage"]),
  hero("illari", "일리아리", "support", ["poke"], ["damage"]),
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
