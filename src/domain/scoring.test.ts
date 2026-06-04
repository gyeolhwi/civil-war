import { describe, expect, it } from "vitest";
import { COMBO_PENALTY, comboPenalty, type TeamSlot } from "./scoring";

// 헬퍼: 슬롯 생성
const tank = (comps: TeamSlot["comps"]): TeamSlot => ({
  assignedRole: "tank",
  comps,
  funcs: [],
});
const dps = (comps: TeamSlot["comps"], funcs: TeamSlot["funcs"]): TeamSlot => ({
  assignedRole: "dps",
  comps,
  funcs,
});
const sup = (comps: TeamSlot["comps"], funcs: TeamSlot["funcs"]): TeamSlot => ({
  assignedRole: "support",
  comps,
  funcs,
});

describe("comboPenalty", () => {
  it("응집된 다이브 조합 + 앵커·메인힐 있으면 패널티 0", () => {
    const team: TeamSlot[] = [
      tank(["dive"]),
      dps(["dive"], ["hitscan"]), // 앵커
      dps(["dive"], ["flanker"]),
      sup(["dive"], ["main_heal"]),
      sup(["dive"], ["off_heal"]),
    ];
    expect(comboPenalty(team)).toBe(0);
  });

  it("탱 컨셉(dive)에 안 맞는 딜·힐 멤버마다 compMismatch 누적", () => {
    const team: TeamSlot[] = [
      tank(["dive"]),
      dps(["poke"], ["hitscan"]), // 엇박 1
      dps(["dive"], ["flanker"]),
      sup(["dive"], ["main_heal"]),
      sup(["poke"], ["off_heal"]), // 엇박 2
    ];
    expect(comboPenalty(team)).toBe(COMBO_PENALTY.compMismatch * 2);
  });

  it("딜러에 안정 딜(히트스캔/투사체) 앵커가 없으면 noAnchorDps", () => {
    const team: TeamSlot[] = [
      tank(["dive"]),
      dps(["dive"], ["flanker"]),
      dps(["dive"], ["flanker"]),
      sup(["dive"], ["main_heal"]),
      sup(["dive"], ["off_heal"]),
    ];
    expect(comboPenalty(team)).toBe(COMBO_PENALTY.noAnchorDps);
  });

  it("메인힐이 없으면 noMainHeal", () => {
    const team: TeamSlot[] = [
      tank(["poke"]),
      dps(["poke"], ["hitscan"]),
      dps(["poke"], ["projectile"]),
      sup(["poke"], ["damage"]),
      sup(["poke"], ["off_heal"]),
    ];
    expect(comboPenalty(team)).toBe(COMBO_PENALTY.noMainHeal);
  });

  it("힐러 둘 다 공격힐이면 bothDamageSupport(+ 메인힐 부재)", () => {
    const team: TeamSlot[] = [
      tank(["poke"]),
      dps(["poke"], ["hitscan"]),
      dps(["poke"], ["projectile"]),
      sup(["poke"], ["damage"]),
      sup(["poke"], ["damage"]),
    ];
    expect(comboPenalty(team)).toBe(
      COMBO_PENALTY.noMainHeal + COMBO_PENALTY.bothDamageSupport,
    );
  });

  it("보유 영웅 없는(comps 빈) 멤버는 응집 판정에서 면제", () => {
    const team: TeamSlot[] = [
      tank(["dive"]),
      dps([], []), // 빈 슬롯 → 면제
      dps(["dive"], ["hitscan"]),
      sup(["dive"], ["main_heal"]),
      sup(["dive"], ["off_heal"]),
    ];
    expect(comboPenalty(team)).toBe(0);
  });

  it("탱 comp가 비면 응집 판정 자체를 건너뜀", () => {
    const team: TeamSlot[] = [
      tank([]),
      dps(["poke"], ["hitscan"]),
      dps(["dive"], ["flanker"]),
      sup(["brawl"], ["main_heal"]),
      sup(["poke"], ["off_heal"]),
    ];
    expect(comboPenalty(team)).toBe(0);
  });

  it("플렉스(comp 복수)는 하나라도 겹치면 응집 통과", () => {
    const team: TeamSlot[] = [
      tank(["dive"]),
      dps(["poke", "dive"], ["hitscan"]), // dive 겹침 → 통과
      dps(["dive"], ["flanker"]),
      sup(["dive"], ["main_heal"]),
      sup(["dive"], ["off_heal"]),
    ];
    expect(comboPenalty(team)).toBe(0);
  });
});
