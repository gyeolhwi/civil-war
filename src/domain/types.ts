/** 오버워치 역할 (5v5: 1탱-2딜-2힐) */
export type Role = "tank" | "dps" | "support";

/** 서브 유형 9종 (docs/requirements.md §6.2) */
export type SubRole =
  | "brawl_tank"
  | "dive_tank"
  | "poke_tank"
  | "main_dps"
  | "playmaker_dps"
  | "utility_dps"
  | "main_support"
  | "utility_support"
  | "damage_support";

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
  /** 카탈로그상 가능한 서브유형 (중복 영웅은 복수) */
  subRoles: SubRole[];
  /** 점수·조합 계산에 쓰는 단일 정규화 서브유형 (§6.3) */
  normalizedSubRole: SubRole;
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
