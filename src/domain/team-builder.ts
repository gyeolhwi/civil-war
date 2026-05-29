import { HERO_BY_CODE } from "@/constants/heroes";
import { MAPS } from "@/constants/maps";
import {
  comboPenalty,
  individualScore,
  type PreferenceKind,
  teamScore,
} from "@/domain/scoring";
import type { Role, SubRole } from "@/domain/types";

/**
 * 자동 밸런스 팀 빌딩 (docs/workflow.md [5-A], requirements §7·§8)
 *
 * 순수 함수 모듈. 각 5인 팀은 역할 슬롯 1탱-2딜-2힐을 만족해야 하고,
 * 배정 포지션에 티어(rating)가 있는 멤버만 그 슬롯에 들어갈 수 있다 (§7.2).
 * 한 5인 집합 내에서는 final_score를 최대화하는 역할 배치를 선택하고
 * (= 시스템이 각 팀을 합리적으로 정렬), 분할들 사이에서 점수차로 균형을 맞춘다.
 */

export interface Participant {
  id: string;
  battleTag: string;
  discordName: string | null;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  /** 티어가 있는 역할 → 환산 점수 (rating_score). 없는 역할은 키 없음 = 배정 불가 */
  ratings: Partial<Record<Role, number>>;
  heroCodes: string[];
  mapCodes: string[];
}

export interface AssignedMember {
  participant: Participant;
  role: Role;
  preferenceKind: PreferenceKind;
  individualScore: number;
  ownedSubRoles: SubRole[];
}

export interface BuiltTeam {
  members: AssignedMember[];
  totalScore: number;
  comboBonus: number;
  comboPenalty: number;
  finalScore: number;
}

export interface Candidate {
  teamA: BuiltTeam;
  teamB: BuiltTeam;
  diff: number;
}

/** 후보 풀에서 무작위 1개를 고를 때 고려할 상위 N개 (workflow [5-A] 4번) */
export const TOP_CANDIDATE_POOL = 10;

function preferenceKind(p: Participant, role: Role): PreferenceKind {
  if (p.primaryRole === role) return "preferred";
  if (p.secondaryRole === role) return "additional";
  return "hasRating";
}

/** 배정 역할 기준, 멤버가 선호 영웅으로 보유한 정규화 서브유형 집합 (§8.2) */
function ownedSubRolesFor(p: Participant, role: Role): SubRole[] {
  const subs = new Set<SubRole>();
  for (const code of p.heroCodes) {
    const hero = HERO_BY_CODE[code];
    if (hero?.role === role) subs.add(hero.normalizedSubRole);
  }
  return [...subs];
}

/** 멤버 보유 역할 중 최고 환산 점수 (티어 없는 역할 배정 시 fallback) */
function bestRating(p: Participant): number {
  const vals = Object.values(p.ratings).filter((v): v is number => v != null);
  return vals.length ? Math.max(...vals) : 0;
}

function toSlot(p: Participant, role: Role): AssignedMember {
  // 자동 밸런스는 티어 있는 역할만 배정하지만, 팀장 드래프트는 티어 없는
  // (안 하는) 포지션도 배정 가능 → 그 경우 최고 티어를 기준으로 환산.
  const ratingScore = p.ratings[role] ?? bestRating(p);
  const kind = preferenceKind(p, role);
  return {
    participant: p,
    role,
    preferenceKind: kind,
    individualScore: individualScore(ratingScore, kind),
    ownedSubRoles: ownedSubRolesFor(p, role),
  };
}

function assemble(members: AssignedMember[]): BuiltTeam {
  const penalty = comboPenalty(
    members.map((m) => ({
      assignedRole: m.role,
      ownedSubRoles: m.ownedSubRoles,
    })),
  );
  const bonus = 0; // 조합 보너스는 v1 미사용 (teams.combo_bonus default 0)
  const total = members.reduce((s, m) => s + m.individualScore, 0);
  return {
    members,
    totalScore: total,
    comboBonus: bonus,
    comboPenalty: penalty,
    finalScore: teamScore(
      members.map((m) => m.individualScore),
      bonus,
      penalty,
    ),
  };
}

/**
 * (참가자, 배정 역할) 목록으로 팀을 조립 (점수·조합 패널티 계산).
 * 자동 밸런스·드래프트 양쪽에서 재사용. 부분 팀(1~5명)도 허용 — 드래프트 실시간 점수용.
 */
export function assembleTeam(
  members: { participant: Participant; role: Role }[],
): BuiltTeam {
  return assemble(members.map((m) => toSlot(m.participant, m.role)));
}

/** 인덱스 0..n-1에서 2개를 고르는 모든 쌍 */
function pairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) out.push([i, j]);
  }
  return out;
}

/**
 * 5인 집합에서 1탱-2딜-2힐 슬롯을 채우는 배치 중 final_score 최대값을 반환.
 * 어떤 배치도 슬롯을 못 채우면 null (배정 가능 티어 부족).
 */
function bestAssignment(five: Participant[]): BuiltTeam | null {
  let best: BuiltTeam | null = null;

  for (let t = 0; t < 5; t++) {
    if (five[t].ratings.tank == null) continue;
    const rest = five.filter((_, i) => i !== t);

    for (const [i, j] of pairs(4)) {
      const dps = [rest[i], rest[j]];
      if (dps.some((m) => m.ratings.dps == null)) continue;
      const support = rest.filter((_, k) => k !== i && k !== j);
      if (support.some((m) => m.ratings.support == null)) continue;

      const team = assemble([
        toSlot(five[t], "tank"),
        ...dps.map((m) => toSlot(m, "dps")),
        ...support.map((m) => toSlot(m, "support")),
      ]);
      if (!best || team.finalScore > best.finalScore) best = team;
    }
  }
  return best;
}

/** 인덱스 0을 반드시 포함하는 5인 부분집합 (분할 미러 중복 제거) */
function halfSubsets(): number[][] {
  const out: number[][] = [];
  // 0은 고정, 1..9 중 4개 선택
  const choose4 = (start: number, acc: number[]) => {
    if (acc.length === 4) {
      out.push([0, ...acc]);
      return;
    }
    for (let k = start; k <= 9; k++) choose4(k + 1, [...acc, k]);
  };
  choose4(1, []);
  return out;
}

/**
 * 모든 유효한 5+5 분할 후보를 점수차 오름차순으로 반환.
 * 유효한 조합이 하나도 없으면 빈 배열 (SC-50: 팀장 직접 지정 권유).
 */
export function generateCandidates(participants: Participant[]): Candidate[] {
  if (participants.length !== 10) {
    throw new Error("참가자는 정확히 10명이어야 합니다");
  }

  const candidates: Candidate[] = [];
  for (const idxA of halfSubsets()) {
    const inA = new Set(idxA);
    const teamAMembers = idxA.map((i) => participants[i]);
    const teamBMembers = participants.filter((_, i) => !inA.has(i));

    const teamA = bestAssignment(teamAMembers);
    const teamB = bestAssignment(teamBMembers);
    if (!teamA || !teamB) continue;

    candidates.push({
      teamA,
      teamB,
      diff: Math.abs(teamA.finalScore - teamB.finalScore),
    });
  }

  candidates.sort((a, b) => a.diff - b.diff);
  return candidates;
}

/**
 * 자동 밸런스: 점수차 최소 상위 10개 후보 중 무작위 1개 선택.
 * 유효 조합이 없으면 null.
 */
export function buildBalancedTeams(
  participants: Participant[],
  rng: () => number = Math.random,
): Candidate | null {
  const candidates = generateCandidates(participants);
  if (candidates.length === 0) return null;
  const pool = candidates.slice(0, TOP_CANDIDATE_POOL);
  return pool[Math.floor(rng() * pool.length)];
}

export interface MapSelection {
  mapCode: string;
  /** 이 맵을 선호한 참가자 */
  preferredBy: Participant[];
  /** 아무도 선호하지 않아 전체 풀에서 뽑은 경우 (SC-55 fallback) */
  fromFallback: boolean;
}

/**
 * 맵 자동 선정 (workflow [8]): 참가자 선호 맵 합집합에서 무작위 1개.
 * 합집합이 비면 전체 활성 맵 풀에서 무작위 (SC-55).
 */
export function selectMap(
  participants: Participant[],
  rng: () => number = Math.random,
): MapSelection {
  const union = [...new Set(participants.flatMap((p) => p.mapCodes))];

  if (union.length === 0) {
    const pool = MAPS.filter((m) => m.isActive);
    const mapCode = pool[Math.floor(rng() * pool.length)].code;
    return { mapCode, preferredBy: [], fromFallback: true };
  }

  const mapCode = union[Math.floor(rng() * union.length)];
  return {
    mapCode,
    preferredBy: participants.filter((p) => p.mapCodes.includes(mapCode)),
    fromFallback: false,
  };
}
