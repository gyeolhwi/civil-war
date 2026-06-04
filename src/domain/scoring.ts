import type { Comp, HeroFunc, Role } from "@/domain/types";

/**
 * 점수·조합 패널티 도메인 로직 (docs/requirements.md §7·§8)
 * 모든 계산은 순수 함수. DB에는 결과만 캐시한다.
 */

/** 선호도 가중치 (§7.2) */
export const PREFERENCE_WEIGHT = {
  /** 1순위 선호 포지션 */
  preferred: 1.0,
  /** 추가 가능 포지션 */
  additional: 0.9,
  /** 선호 목록에 없지만 티어 있음 */
  hasRating: 0.75,
} as const;

export type PreferenceKind = keyof typeof PREFERENCE_WEIGHT;

/** 개인 역할 점수 = 배정 포지션 티어 점수 × 선호도 가중치 (§7.3) */
export function individualScore(
  ratingScore: number,
  kind: PreferenceKind,
): number {
  return Math.round(ratingScore * PREFERENCE_WEIGHT[kind]);
}

/**
 * 조합 패널티 수치 (튜닝 대상).
 * 분류 모델: docs/discussion/hero-classification.md (comp 응집 + func within-role)
 */
export const COMBO_PENALTY = {
  /** 딜러 중 안정 딜(히트스캔/투사체) 앵커 0명 */
  noAnchorDps: 300,
  /** 메인힐 0명 */
  noMainHeal: 500,
  /** 힐러 2명 모두 공격힐 */
  bothDamageSupport: 400,
  /** 힐러 2명 모두 보조힐 */
  bothOffHeal: 250,
  /** 탱 컨셉(comp)에 안 맞는 딜·힐 멤버 1명당 */
  compMismatch: 150,
} as const;

/** 한 팀원의 조합 판정용 정보 */
export interface TeamSlot {
  assignedRole: Role;
  /** 배정 역할 선호 영웅으로 커버하는 조합 성향 (없으면 빈 배열 = 판정 면제) */
  comps: Comp[];
  /** 배정 역할 선호 영웅의 기능 집합 */
  funcs: HeroFunc[];
}

/**
 * 팀 조합 패널티 합계 (양수 = 총 차감액). 감점만, 시너지 가점 없음.
 * - within-role(func): 딜 앵커·메인힐 부재, 힐러 편중
 * - 응집(comp): 탱커가 팀 컨셉을 정의 → 안 맞는 딜·힐 멤버마다 감점
 *   (기존 "탱-딜 불일치"·"딜러 동일유형"을 이 한 틀로 흡수)
 */
export function comboPenalty(team: TeamSlot[]): number {
  const dps = team.filter((s) => s.assignedRole === "dps");
  const support = team.filter((s) => s.assignedRole === "support");
  const tank = team.find((s) => s.assignedRole === "tank");

  let penalty = 0;

  // 딜 앵커 부재: 딜러 기능 중 히트스캔/투사체(안정 딜)가 하나도 없음
  const dpsFuncs = new Set(dps.flatMap((s) => s.funcs));
  if (
    dpsFuncs.size > 0 &&
    !dpsFuncs.has("hitscan") &&
    !dpsFuncs.has("projectile")
  ) {
    penalty += COMBO_PENALTY.noAnchorDps;
  }

  // 메인힐 부재
  const supportFuncs = new Set(support.flatMap((s) => s.funcs));
  if (supportFuncs.size > 0 && !supportFuncs.has("main_heal")) {
    penalty += COMBO_PENALTY.noMainHeal;
  }

  // 힐러 2명이 모두 공격힐 / 모두 보조힐
  if (support.length === 2) {
    const bothOnly = (f: HeroFunc) =>
      support.every((s) => s.funcs.length > 0 && s.funcs.every((x) => x === f));
    if (bothOnly("damage")) penalty += COMBO_PENALTY.bothDamageSupport;
    else if (bothOnly("off_heal")) penalty += COMBO_PENALTY.bothOffHeal;
  }

  // 조합 응집: 탱커 comp가 팀 컨셉 → 딜·힐이 그 comp에 못 맞으면 멤버당 감점
  const tankComps = new Set(tank?.comps ?? []);
  if (tankComps.size > 0) {
    for (const s of team) {
      if (s.assignedRole === "tank") continue;
      if (s.comps.length === 0) continue; // 보유 영웅 없음 → 면제(오패널티 방지)
      if (!s.comps.some((c) => tankComps.has(c)))
        penalty += COMBO_PENALTY.compMismatch;
    }
  }

  return penalty;
}

/** 팀 점수 = 개인 점수 합 + 조합 보너스 − 조합 패널티 (§7.4) */
export function teamScore(
  individualScores: number[],
  comboBonus: number,
  penalty: number,
): number {
  const total = individualScores.reduce((a, b) => a + b, 0);
  return total + comboBonus - penalty;
}
