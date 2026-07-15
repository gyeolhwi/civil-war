import type { BuiltTeam } from "@/domain/team-builder";
import type { Role } from "@/domain/types";

/**
 * 빠른편성 결과의 밸런스 품질 지표 (표시 전용, 순수 함수).
 * team-builder를 건드리지 않고 BuiltTeam 2개로부터 파생 계산한다.
 * (docs/discussion/paste-to-teams-plan.md §5.2)
 */

export interface BalanceMetrics {
  /** 팀 최종 점수차 */
  totalDiff: number;
  /** 역할별 점수차 (탱/딜/힐) */
  roleDiff: Record<Role, number>;
  /** 각 팀 내부 점수 표준편차 [A, B] */
  stdDev: [number, number];
}

function roleSum(team: BuiltTeam, role: Role): number {
  return team.members
    .filter((m) => m.role === role)
    .reduce((s, m) => s + m.individualScore, 0);
}

function stdDev(team: BuiltTeam): number {
  const xs = team.members.map((m) => m.individualScore);
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
  return Math.round(Math.sqrt(variance));
}

export function computeMetrics(a: BuiltTeam, b: BuiltTeam): BalanceMetrics {
  return {
    totalDiff: Math.abs(a.finalScore - b.finalScore),
    roleDiff: {
      tank: Math.abs(roleSum(a, "tank") - roleSum(b, "tank")),
      dps: Math.abs(roleSum(a, "dps") - roleSum(b, "dps")),
      support: Math.abs(roleSum(a, "support") - roleSum(b, "support")),
    },
    stdDev: [stdDev(a), stdDev(b)],
  };
}
