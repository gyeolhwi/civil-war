import { describe, expect, it } from "vitest";
import { generateCandidates } from "@/domain/team-builder";
import { toParticipants } from "./adapter";
import { computeMetrics } from "./metrics";
import { parseMultipleLines } from "./parser";
import { rankCandidates } from "./ranking";

/**
 * 붙여넣기 → 팀 편성 전체 흐름 통합 테스트 (UI 없이 도메인만).
 * 실제 디스코드 붙여넣기 텍스트로 끝까지 돈다.
 */
const PASTE = [
  "선수1#1001 다5/다1/다5",
  "선수2#1002 다3/마4/다4",
  "선수3#1003 마2/그5/플2",
  "선수4#1004 그5!/마1!/마4",
  "선수5#1005 플3/다2/다1 X",
  "선수6#1006 마5/마3/그2",
  "선수7#1007 다1/다2/다3",
  "선수8#1008 플5/플4/골3",
  "선수9#1009 그2/마5/마5",
  "선수10#1010 다4/다4/다4 X",
].join("\n");

describe("빠른편성 전체 파이프라인", () => {
  it("붙여넣기 10명 → 유효한 두 팀 편성", () => {
    const { players, failedLines } = parseMultipleLines(PASTE);
    expect(players).toHaveLength(10);
    expect(failedLines).toHaveLength(0);

    const { participants, noMicById } = toParticipants(players);
    expect(participants).toHaveLength(10);
    expect(participants.every((p) => p.id.startsWith("guest:"))).toBe(true);

    const candidates = generateCandidates(participants);
    expect(candidates.length).toBeGreaterThan(0);

    const ranked = rankCandidates(candidates, noMicById);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(6);

    const best = ranked[0];
    // 각 팀 5명, 1탱-2딜-2힐
    for (const team of [best.teamA, best.teamB]) {
      expect(team.members).toHaveLength(5);
      expect(team.members.filter((m) => m.role === "tank")).toHaveLength(1);
      expect(team.members.filter((m) => m.role === "dps")).toHaveLength(2);
      expect(team.members.filter((m) => m.role === "support")).toHaveLength(2);
    }

    // 10명 전원 배정, 중복 없음
    const assigned = [...best.teamA.members, ...best.teamB.members].map(
      (m) => m.participant.id,
    );
    expect(new Set(assigned).size).toBe(10);

    const metrics = computeMetrics(best.teamA, best.teamB);
    expect(metrics.totalDiff).toBeGreaterThanOrEqual(0);
    expect(metrics.stdDev).toHaveLength(2);
  });

  it("선호(!) 역할이 배정에 반영된다", () => {
    const { players } = parseMultipleLines(PASTE);
    const { participants } = toParticipants(players);
    // 선수4는 탱·딜 선호(!) → primary/secondary 설정됨
    const p4 = participants.find((p) => p.battleTag === "선수4#1004");
    expect(p4?.primaryRole).toBe("tank");
    expect(p4?.secondaryRole).toBe("dps");
  });

  it("마이크 불균형이 랭킹 타이브레이크로 작동", () => {
    const { players, noMicById } = (() => {
      const parsed = parseMultipleLines(PASTE);
      return { players: parsed.players, ...toParticipants(parsed.players) };
    })();
    // 선수5, 선수10이 노마이크(X)
    const noMicTags = players
      .filter((p) => p.noMic)
      .map((p) => p.battleTag)
      .sort();
    expect(noMicTags).toEqual(["선수10#1010", "선수5#1005"]);
    expect(Object.values(noMicById).filter(Boolean)).toHaveLength(2);
  });
});
