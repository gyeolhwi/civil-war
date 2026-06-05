/** 오버워치 역할 (5v5: 1탱-2딜-2힐) */
export type Role = "tank" | "dps" | "support";

/** 조합 성향 — 팀 응집(코히전) 판정용. 전 역할 공통 (docs/discussion/hero-classification.md) */
export type Comp = "dive" | "brawl" | "poke";

/** 역할 내 기능 — within-role 판정용. 탱커는 없음(comp가 곧 기능) */
export type HeroFunc =
  // 공격(딜)
  | "hitscan"
  | "flanker"
  | "projectile"
  | "sub"
  // 지원(힐)
  | "main_heal"
  | "off_heal"
  | "damage";

/** 티어 8종 (docs/requirements.md §7.1) */
export type Tier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "grandmaster"
  | "champion";

/** 디비전 (5=최하, 1=최상) */
export type Division = 1 | 2 | 3 | 4 | 5;

/** 게임 모드 6종 (2026 기준) */
export type GameMode =
  | "control"
  | "escort"
  | "hybrid"
  | "push"
  | "flashpoint"
  | "clash";

/** 팀 빌딩 모드 */
export type BuildMode =
  | "basic"
  | "captain_top"
  | "captain_tank"
  | "captain_fun"
  | "captain_manual";

export interface Hero {
  code: string;
  nameKo: string;
  role: Role;
  /** 조합 성향 (1~2개). 팀 응집 판정에 사용 */
  comp: Comp[];
  /** 역할 내 기능. 탱커는 빈 배열 */
  func: HeroFunc[];
  image: string;
  isActive: boolean;
}

export interface GameMap {
  code: string;
  nameKo: string;
  mode: GameMode;
  image: string;
  isActive: boolean;
}

/** 영웅·맵 마스터 데이터 (DB 로드본). 서버 로더·클라 Context 공통 shape */
export interface RefData {
  heroes: Hero[];
  maps: GameMap[];
  heroByCode: Record<string, Hero>;
  mapByCode: Record<string, GameMap>;
  heroesByRole: Record<Role, Hero[]>;
}
