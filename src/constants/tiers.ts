import type { Division, Tier } from "@/domain/types";

/** 티어 기본 점수 (docs/requirements.md §7.1) */
export const TIER_BASE: Record<Tier, number> = {
  bronze: 1000,
  silver: 2000,
  gold: 3000,
  platinum: 4000,
  diamond: 5000,
  master: 6000,
  grandmaster: 7000,
  champion: 8000,
};

/** 디비전 보정 (5=+0 ... 1=+400) */
export const DIVISION_BONUS: Record<Division, number> = {
  5: 0,
  4: 100,
  3: 200,
  2: 300,
  1: 400,
};

export const TIER_LABEL_KO: Record<Tier, string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  platinum: "플래티넘",
  diamond: "다이아몬드",
  master: "마스터",
  grandmaster: "그랜드마스터",
  champion: "챔피언",
};

export const TIER_ORDER: Tier[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "master",
  "grandmaster",
  "champion",
];

/** 티어+디비전 → 환산 점수 */
export function ratingScore(tier: Tier, division: Division): number {
  return TIER_BASE[tier] + DIVISION_BONUS[division];
}
