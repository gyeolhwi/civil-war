import type { Participant } from "@/domain/team-builder";
import type { Role } from "@/domain/types";

/**
 * 팀장 모드 스네이크 드래프트 로직 (docs/workflow.md [5-B][6]).
 * 순수 함수 — 상태는 호출부(위저드)가 관리. 여기선 순서·슬롯·자격·팀장선정만 제공.
 */

export const ROLES: Role[] = ["tank", "dps", "support"];

/** 팀당 역할 슬롯 (5v5: 1탱-2딜-2힐) */
export const TEAM_SLOTS: Record<Role, number> = { tank: 1, dps: 2, support: 2 };

/**
 * 8픽 순서 (팀장 2명 배치 후 남은 8명). 1팀장=A, 2팀장=B.
 * 1-2-2-2-1 스네이크: A B B A A B B A.
 */
export const DRAFT_ORDER: ("A" | "B")[] = [
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
  "A",
];

/** 멤버의 대표 점수 = 보유 역할 중 최고 rating_score (팀장 선정·정렬용) */
export function playerStrength(p: Participant): number {
  const vals = Object.values(p.ratings).filter((v): v is number => v != null);
  return vals.length ? Math.max(...vals) : 0;
}

/** 최고티어 팀장 2명 (점수 상위 2명) */
export function pickTopCaptains(
  participants: Participant[],
): [Participant, Participant] {
  if (participants.length < 2) {
    throw new Error("팀장을 뽑으려면 최소 2명 필요");
  }
  const sorted = [...participants].sort(
    (a, b) => playerStrength(b) - playerStrength(a),
  );
  return [sorted[0], sorted[1]];
}

/** 한 팀이 이미 채운 역할 수 */
export function usedSlots(members: { role: Role }[]): Record<Role, number> {
  const used: Record<Role, number> = { tank: 0, dps: 0, support: 0 };
  for (const m of members) used[m.role] += 1;
  return used;
}

/** 한 팀의 남은 슬롯 수 */
export function openSlots(members: { role: Role }[]): Record<Role, number> {
  const used = usedSlots(members);
  return {
    tank: TEAM_SLOTS.tank - used.tank,
    dps: TEAM_SLOTS.dps - used.dps,
    support: TEAM_SLOTS.support - used.support,
  };
}

/**
 * 이 팀에 아직 빈 슬롯이 있는 역할들 (1탱-2딜-2힐 구조 유지).
 * 티어 보유 여부와 무관 — 선호/보조/안 하는 포지션이라도 빈 슬롯이면 배정 가능.
 * 점수는 team-builder가 티어 없으면 최고 티어로 환산해 처리.
 */
export function openRoles(teamMembers: { role: Role }[]): Role[] {
  const open = openSlots(teamMembers);
  return ROLES.filter((r) => open[r] > 0);
}

export function teamComplete(members: { role: Role }[]): boolean {
  return members.length === 5;
}

/** 현재 픽이 누구 차례인지 (이미 진행된 픽 수 기준). 8픽 끝나면 null */
export function currentTurn(picksDone: number): "A" | "B" | null {
  return picksDone < DRAFT_ORDER.length ? DRAFT_ORDER[picksDone] : null;
}
