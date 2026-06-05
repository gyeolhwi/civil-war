import type { Comp, HeroFunc, Role } from "@/domain/types";

// 영웅 마스터 데이터(목록·comp·func)는 DB로 이관됨 (0003 마이그레이션).
// 로드는 서버 getRefData() / 클라 useRefData() 사용.
// 이 파일에는 enum 표시 라벨·정렬 순서만 남긴다 (밸런싱 알고리즘의 일부, 코드 유지).

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

/** 역할 표시·정렬 순서 (탱 → 딜 → 힐) */
export const ROLE_ORDER: Record<Role, number> = { tank: 0, dps: 1, support: 2 };
