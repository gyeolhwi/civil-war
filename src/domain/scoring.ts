import type { Role, SubRole } from "@/domain/types";

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

/** 조합 패널티 수치 (§8.1) */
export const COMBO_PENALTY = {
  noMainDps: 300,
  noMainSupport: 500,
  dpsSameType: 150,
  bothDamageSupport: 400,
  bothUtilitySupport: 250,
  tankDpsMismatch: 200,
} as const;

/** 한 팀원의 조합 판정용 정보 */
export interface TeamSlot {
  assignedRole: Role;
  /** 이 멤버가 선호 영웅으로 보유한 서브유형 집합 (§8.2) */
  ownedSubRoles: SubRole[];
}

/**
 * 팀 조합 패널티 합계 (양수 = 총 차감액).
 * 멤버의 선호 영웅 서브유형 집합을 기준으로 판정 (§8.2).
 */
export function comboPenalty(team: TeamSlot[]): number {
  const dps = team.filter((s) => s.assignedRole === "dps");
  const support = team.filter((s) => s.assignedRole === "support");
  const tank = team.find((s) => s.assignedRole === "tank");

  const owned = (slots: TeamSlot[]) =>
    new Set(slots.flatMap((s) => s.ownedSubRoles));

  let penalty = 0;

  const dpsTypes = owned(dps);
  const supportTypes = owned(support);

  // 메인딜 0명
  if (!dpsTypes.has("main_dps")) penalty += COMBO_PENALTY.noMainDps;
  // 메인힐 0명
  if (!supportTypes.has("main_support")) penalty += COMBO_PENALTY.noMainSupport;

  // 딜러 2명이 같은 유형만 보유 (각자 단일 유형 & 동일)
  if (dps.length === 2) {
    const a = new Set(dps[0].ownedSubRoles);
    const b = new Set(dps[1].ownedSubRoles);
    const allSame = a.size === 1 && b.size === 1 && [...a][0] === [...b][0];
    if (allSame) penalty += COMBO_PENALTY.dpsSameType;
  }

  // 힐러 2명이 모두 damage_support / 모두 utility_support
  if (support.length === 2) {
    const bothOnly = (sub: SubRole) =>
      support.every(
        (s) => s.ownedSubRoles.length === 1 && s.ownedSubRoles[0] === sub,
      );
    if (bothOnly("damage_support")) penalty += COMBO_PENALTY.bothDamageSupport;
    else if (bothOnly("utility_support"))
      penalty += COMBO_PENALTY.bothUtilitySupport;
  }

  // 탱-딜 방향성 불일치 (§8.4)
  if (tank) {
    const tankSub = tank.ownedSubRoles[0];
    const hasPlaymaker = dpsTypes.has("playmaker_dps");
    const allPlaymaker =
      dps.length === 2 &&
      dps.every(
        (s) =>
          s.ownedSubRoles.length === 1 &&
          s.ownedSubRoles[0] === "playmaker_dps",
      );
    // dive_tank인데 변수딜 0명
    if (tankSub === "dive_tank" && !hasPlaymaker)
      penalty += COMBO_PENALTY.tankDpsMismatch;
    // poke_tank인데 딜러 둘 다 변수딜
    else if (tankSub === "poke_tank" && allPlaymaker)
      penalty += COMBO_PENALTY.tankDpsMismatch;
    // brawl_tank은 면제
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
