import { ratingScore } from "@/constants/tiers";
import type { Participant } from "@/domain/team-builder";
import type { Role } from "@/domain/types";
import type { ParsedPlayer } from "./types";

/**
 * ParsedPlayer[] → Participant[] 어댑터.
 * 공유 엔진(`team-builder`)이 그대로 소비할 수 있게 변환한다.
 * (docs/discussion/paste-to-teams-plan.md §3)
 *
 * - 점수: civil-war `ratingScore(tier, division)` 사용 (두 세계 동일 체계)
 * - 비선호(`?`) 역할: `ratings`에서 생략 → 기존 "배정 불가" 규칙으로 자동배정 제외
 * - 선호(`!`): 첫째=primaryRole, 둘째=secondaryRole
 * - id: `guest:` 프리픽스로 관리형 흐름 누수를 감지 가능하게
 * - noMic: Participant에 담지 않고 별도 맵으로 반환 (공유 타입 불가침)
 */

const ROLES: Role[] = ["tank", "dps", "support"];

export interface AdaptResult {
  participants: Participant[];
  /** participant.id → 마이크 미사용 여부 */
  noMicById: Record<string, boolean>;
}

export function toParticipants(players: ParsedPlayer[]): AdaptResult {
  const participants: Participant[] = [];
  const noMicById: Record<string, boolean> = {};

  for (const p of players) {
    const id = `guest:${p.battleTag}`;
    const ratings: Partial<Record<Role, number>> = {};
    const preferredRoles: Role[] = [];

    for (const role of ROLES) {
      const rank = p.ranks[role];
      if (!rank) continue;
      // 비선호 역할은 자동배정 대상에서 제외 (ratings 생략)
      if (rank.avoided) continue;
      ratings[role] = ratingScore(rank.tier, rank.division);
      if (rank.preferred) preferredRoles.push(role);
    }

    participants.push({
      id,
      battleTag: p.battleTag,
      discordName: null,
      primaryRole: preferredRoles[0] ?? null,
      secondaryRole: preferredRoles[1] ?? null,
      ratings,
      heroCodes: [],
      heroes: [],
      mapCodes: [],
    });
    noMicById[id] = p.noMic;
  }

  return { participants, noMicById };
}
