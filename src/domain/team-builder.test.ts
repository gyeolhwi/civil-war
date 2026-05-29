import { describe, expect, it } from "vitest";
import type { Role } from "@/domain/types";
import {
  buildBalancedTeams,
  generateCandidates,
  type Participant,
  selectMap,
  TOP_CANDIDATE_POOL,
} from "./team-builder";

/** 모든 역할에 티어가 있는 멤버 (배정 항상 가능) */
function full(
  id: string,
  scores: { tank: number; dps: number; support: number },
  opts: Partial<Participant> = {},
): Participant {
  return {
    id,
    battleTag: `${id}#1000`,
    discordName: null,
    primaryRole: null,
    secondaryRole: null,
    ratings: scores,
    heroCodes: [],
    mapCodes: [],
    ...opts,
  };
}

function tenFull(): Participant[] {
  return Array.from({ length: 10 }, (_, i) =>
    full(`m${i}`, { tank: 3000 + i * 100, dps: 3500 - i * 50, support: 3200 }),
  );
}

function roleCounts(roles: Role[]): Record<Role, number> {
  return roles.reduce((acc, r) => ({ ...acc, [r]: acc[r] + 1 }), {
    tank: 0,
    dps: 0,
    support: 0,
  } as Record<Role, number>);
}

describe("generateCandidates", () => {
  it("10명 미만/초과면 에러", () => {
    expect(() => generateCandidates([])).toThrow();
    expect(() => generateCandidates(tenFull().slice(0, 9))).toThrow();
  });

  it("모든 후보 팀은 1탱-2딜-2힐 슬롯을 만족한다", () => {
    const candidates = generateCandidates(tenFull());
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      for (const team of [c.teamA, c.teamB]) {
        expect(team.members).toHaveLength(5);
        expect(roleCounts(team.members.map((m) => m.role))).toEqual({
          tank: 1,
          dps: 2,
          support: 2,
        });
      }
    }
  });

  it("점수차 오름차순으로 정렬된다", () => {
    const diffs = generateCandidates(tenFull()).map((c) => c.diff);
    const sorted = [...diffs].sort((a, b) => a - b);
    expect(diffs).toEqual(sorted);
  });

  it("탱커 가능자가 1명뿐이면 유효 조합이 없다 (SC-50)", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      full(`m${i}`, { tank: 3000, dps: 3000, support: 3000 }),
    );
    // 9명에게서 탱 티어 제거 → 양 팀 모두 탱 1명 불가
    for (let i = 1; i < 10; i++) {
      players[i].ratings = { dps: 3000, support: 3000 };
    }
    expect(generateCandidates(players)).toHaveLength(0);
  });

  it("final_score = 개인점수합 − 조합패널티", () => {
    const c = generateCandidates(tenFull())[0];
    const t = c.teamA;
    expect(t.finalScore).toBe(t.totalScore + t.comboBonus - t.comboPenalty);
  });
});

describe("buildBalancedTeams", () => {
  it("rng=0이면 점수차 최소(상위 풀 첫번째) 후보를 고른다", () => {
    const participants = tenFull();
    const all = generateCandidates(participants);
    const picked = buildBalancedTeams(participants, () => 0);
    expect(picked).not.toBeNull();
    expect(picked?.diff).toBe(all[0].diff);
  });

  it("상위 풀 범위 내에서만 선택한다", () => {
    const participants = tenFull();
    const all = generateCandidates(participants);
    const maxPoolDiff = all[Math.min(TOP_CANDIDATE_POOL, all.length) - 1].diff;
    // rng≈1 → 풀의 마지막 후보
    const picked = buildBalancedTeams(participants, () => 0.999);
    expect(picked?.diff).toBeLessThanOrEqual(maxPoolDiff);
  });

  it("유효 조합이 없으면 null", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      full(`m${i}`, { tank: 3000, dps: 3000, support: 3000 }),
    );
    for (let i = 1; i < 10; i++) players[i].ratings = { dps: 3000 };
    expect(buildBalancedTeams(players)).toBeNull();
  });

  it("주 포지션으로 배정되면 가중치 1.0 (개인점수 = 티어점수)", () => {
    // 모두 탱 주포지션 + 탱 4000. 탱 슬롯에 들어간 멤버는 개인점수 4000
    const players = Array.from({ length: 10 }, (_, i) =>
      full(
        `m${i}`,
        { tank: 4000, dps: 3000, support: 3000 },
        { primaryRole: "tank" as Role },
      ),
    );
    const c = generateCandidates(players)[0];
    for (const team of [c.teamA, c.teamB]) {
      const tank = team.members.find((m) => m.role === "tank");
      expect(tank?.individualScore).toBe(4000);
    }
  });
});

describe("selectMap", () => {
  it("참가자 선호 맵 합집합에서 고른다", () => {
    const participants = tenFull();
    participants[0].mapCodes = ["busan"];
    participants[1].mapCodes = ["busan", "ilios"];
    const sel = selectMap(participants, () => 0);
    expect(["busan", "ilios"]).toContain(sel.mapCode);
    expect(sel.fromFallback).toBe(false);
    expect(sel.preferredBy.length).toBeGreaterThan(0);
  });

  it("아무도 선호 맵이 없으면 전체 풀에서 fallback (SC-55)", () => {
    const sel = selectMap(tenFull(), () => 0);
    expect(sel.fromFallback).toBe(true);
    expect(sel.mapCode).toBeTruthy();
    expect(sel.preferredBy).toHaveLength(0);
  });

  it("선택된 맵을 선호한 참가자만 preferredBy에 담는다", () => {
    const participants = tenFull();
    participants[0].mapCodes = ["busan"];
    participants[3].mapCodes = ["busan"];
    const sel = selectMap(participants, () => 0); // 합집합 ["busan"] → busan
    expect(sel.mapCode).toBe("busan");
    expect(sel.preferredBy.map((p) => p.id).sort()).toEqual(["m0", "m3"]);
  });
});
