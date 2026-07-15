import {
  assembleTeam,
  type BuiltTeam,
  type Candidate,
  type Participant,
} from "@/domain/team-builder";
import type { Role } from "@/domain/types";

/**
 * 결과 화면의 팀 레이아웃·드래그 스왑 순수 헬퍼.
 * 슬롯 인덱스가 곧 역할이므로, 스왑하면 팀·역할이 동시에 바뀐다(자유 스왑).
 * (docs/discussion/paste-to-teams-plan.md §6)
 */

/** 슬롯 인덱스별 역할 (0 탱, 1·2 딜, 3·4 힐) */
export const SLOT_ROLES: Role[] = ["tank", "dps", "dps", "support", "support"];

export type TeamKey = "A" | "B";

export interface Layout {
  /** 길이 5, 슬롯 순서 */
  A: Participant[];
  B: Participant[];
}

function teamToSlots(team: BuiltTeam): Participant[] {
  const byRole = (role: Role) =>
    team.members.filter((m) => m.role === role).map((m) => m.participant);
  const [tank] = byRole("tank");
  const dps = byRole("dps");
  const support = byRole("support");
  return [tank, dps[0], dps[1], support[0], support[1]];
}

export function candidateToLayout(c: Candidate): Layout {
  return { A: teamToSlots(c.teamA), B: teamToSlots(c.teamB) };
}

/** 슬롯 배열 → BuiltTeam (assembleTeam으로 점수·패널티 재계산) */
export function buildFromSlots(slots: Participant[]): BuiltTeam {
  return assembleTeam(
    slots.map((p, i) => ({ participant: p, role: SLOT_ROLES[i] })),
  );
}

/** slotId "A-2" → ["A", 2] */
export function parseSlotId(id: string): [TeamKey, number] {
  const [team, idx] = id.split("-");
  return [team as TeamKey, Number(idx)];
}

/** 두 슬롯의 참가자를 교환한 새 Layout */
export function swapSlots(layout: Layout, idA: string, idB: string): Layout {
  const [ta, ia] = parseSlotId(idA);
  const [tb, ib] = parseSlotId(idB);
  const next: Layout = { A: [...layout.A], B: [...layout.B] };
  const tmp = next[ta][ia];
  next[ta][ia] = next[tb][ib];
  next[tb][ib] = tmp;
  return next;
}
