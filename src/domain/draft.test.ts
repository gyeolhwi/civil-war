import { describe, expect, it } from "vitest";
import {
  currentTurn,
  DRAFT_ORDER,
  openRoles,
  openSlots,
  pickTopCaptains,
  playerStrength,
  teamComplete,
} from "./draft";
import type { Participant } from "./team-builder";
import type { Role } from "./types";

function p(id: string, ratings: Participant["ratings"]): Participant {
  return {
    id,
    battleTag: `${id}#1`,
    discordName: null,
    primaryRole: null,
    secondaryRole: null,
    ratings,
    heroCodes: [],
    mapCodes: [],
  };
}

describe("DRAFT_ORDER", () => {
  it("8픽이고 A·B가 각 4번 (1-2-2-2-1 스네이크)", () => {
    expect(DRAFT_ORDER).toEqual(["A", "B", "B", "A", "A", "B", "B", "A"]);
    expect(DRAFT_ORDER.filter((s) => s === "A")).toHaveLength(4);
    expect(DRAFT_ORDER.filter((s) => s === "B")).toHaveLength(4);
  });
});

describe("playerStrength / pickTopCaptains", () => {
  it("보유 역할 중 최고 점수를 반환", () => {
    expect(playerStrength(p("a", { tank: 3000, dps: 5000 }))).toBe(5000);
    expect(playerStrength(p("b", {}))).toBe(0);
  });

  it("점수 상위 2명을 팀장으로", () => {
    const list = [
      p("low", { dps: 2000 }),
      p("top", { tank: 8000 }),
      p("mid", { support: 5000 }),
    ];
    const [c1, c2] = pickTopCaptains(list);
    expect(c1.id).toBe("top");
    expect(c2.id).toBe("mid");
  });
});

describe("슬롯 / 빈 역할", () => {
  it("openSlots: 빈 팀은 1탱-2딜-2힐", () => {
    expect(openSlots([])).toEqual({ tank: 1, dps: 2, support: 2 });
  });

  it("openSlots: 채운 만큼 줄어든다", () => {
    expect(openSlots([{ role: "tank" }, { role: "dps" }])).toEqual({
      tank: 0,
      dps: 1,
      support: 2,
    });
  });

  it("openRoles: 빈 슬롯이 있는 역할만 (티어 무관)", () => {
    expect(openRoles([{ role: "tank" as Role }])).toEqual(["dps", "support"]);
    expect(
      openRoles([{ role: "dps" as Role }, { role: "dps" as Role }]),
    ).toEqual(["tank", "support"]);
    expect(openRoles([])).toEqual(["tank", "dps", "support"]);
  });
});

describe("currentTurn / teamComplete", () => {
  it("픽 진행에 따라 차례가 바뀌고 8픽 후 null", () => {
    expect(currentTurn(0)).toBe("A");
    expect(currentTurn(1)).toBe("B");
    expect(currentTurn(7)).toBe("A");
    expect(currentTurn(8)).toBeNull();
  });

  it("teamComplete: 5명일 때 true", () => {
    expect(teamComplete([{ role: "tank" }])).toBe(false);
    expect(
      teamComplete([
        { role: "tank" },
        { role: "dps" },
        { role: "dps" },
        { role: "support" },
        { role: "support" },
      ]),
    ).toBe(true);
  });
});
