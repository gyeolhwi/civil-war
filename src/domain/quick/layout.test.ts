import { describe, expect, it } from "vitest";
import type { Participant } from "@/domain/team-builder";
import type { Role } from "@/domain/types";
import { buildFromSlots, parseSlotId, SLOT_ROLES, swapSlots } from "./layout";

function p(id: string, scores: Partial<Record<Role, number>>): Participant {
  return {
    id: `guest:${id}`,
    battleTag: `${id}#1000`,
    discordName: null,
    primaryRole: null,
    secondaryRole: null,
    ratings: scores,
    heroCodes: [],
    heroes: [],
    mapCodes: [],
  };
}

const layout = {
  A: [p("A0", {}), p("A1", {}), p("A2", {}), p("A3", {}), p("A4", {})],
  B: [p("B0", {}), p("B1", {}), p("B2", {}), p("B3", {}), p("B4", {})],
};

describe("layout", () => {
  it("슬롯 역할 매핑 (0 탱, 1·2 딜, 3·4 힐)", () => {
    expect(SLOT_ROLES).toEqual(["tank", "dps", "dps", "support", "support"]);
  });

  it("parseSlotId", () => {
    expect(parseSlotId("A-2")).toEqual(["A", 2]);
    expect(parseSlotId("B-4")).toEqual(["B", 4]);
  });

  it("팀 간 스왑 (A 탱 ↔ B 힐) — 팀·역할 동시 변경", () => {
    const next = swapSlots(layout, "A-0", "B-4");
    expect(next.A[0].id).toBe("guest:B4");
    expect(next.B[4].id).toBe("guest:A0");
    // 원본 불변
    expect(layout.A[0].id).toBe("guest:A0");
  });

  it("같은 팀 내 스왑", () => {
    const next = swapSlots(layout, "A-1", "A-3");
    expect(next.A[1].id).toBe("guest:A3");
    expect(next.A[3].id).toBe("guest:A1");
  });

  it("티어 없는 역할로 이동 시 bestRating fallback으로 조립", () => {
    // 탱커 티어만 있는 5명 → dps/support 슬롯은 bestRating으로 환산
    const slots = [
      p("t", { tank: 5000, dps: 4000, support: 3000 }),
      p("d1", { tank: 5000, dps: 4000, support: 3000 }),
      p("d2", { tank: 5000, dps: 4000, support: 3000 }),
      p("s1", { tank: 5000, dps: 4000, support: 3000 }),
      p("only", { tank: 6000 }), // dps/support 티어 없음
    ];
    const built = buildFromSlots(slots);
    expect(built.members).toHaveLength(5);
    // 점수 계산이 예외 없이 완료됨 (fallback 동작)
    expect(built.finalScore).toBeGreaterThan(0);
  });
});
