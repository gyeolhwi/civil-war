import { describe, expect, it } from "vitest";
import { toParticipants } from "./adapter";
import type { ParsedPlayer } from "./types";

function player(overrides: Partial<ParsedPlayer> = {}): ParsedPlayer {
  return {
    battleTag: "Kim#1111",
    ranks: {},
    noMic: false,
    ...overrides,
  };
}

describe("toParticipants", () => {
  it("역할별 티어 → ratingScore 환산", () => {
    const { participants } = toParticipants([
      player({
        ranks: {
          tank: {
            tier: "diamond",
            division: 5,
            preferred: false,
            avoided: false,
          },
          dps: {
            tier: "diamond",
            division: 1,
            preferred: false,
            avoided: false,
          },
          support: {
            tier: "gold",
            division: 3,
            preferred: false,
            avoided: false,
          },
        },
      }),
    ]);
    // diamond5=5000, diamond1=5400, gold3=3200
    expect(participants[0].ratings).toEqual({
      tank: 5000,
      dps: 5400,
      support: 3200,
    });
  });

  it("비선호(avoided) 역할은 ratings에서 생략 (배정 불가)", () => {
    const { participants } = toParticipants([
      player({
        ranks: {
          tank: {
            tier: "diamond",
            division: 3,
            preferred: false,
            avoided: false,
          },
          dps: { tier: "master", division: 2, preferred: false, avoided: true },
        },
      }),
    ]);
    expect(participants[0].ratings.tank).toBe(5200);
    expect("dps" in participants[0].ratings).toBe(false);
  });

  it("선호(!) → primaryRole, 둘째 선호 → secondaryRole", () => {
    const { participants } = toParticipants([
      player({
        ranks: {
          tank: {
            tier: "diamond",
            division: 3,
            preferred: true,
            avoided: false,
          },
          dps: { tier: "master", division: 3, preferred: true, avoided: false },
          support: {
            tier: "gold",
            division: 3,
            preferred: false,
            avoided: false,
          },
        },
      }),
    ]);
    expect(participants[0].primaryRole).toBe("tank");
    expect(participants[0].secondaryRole).toBe("dps");
  });

  it("id는 guest: 프리픽스, noMic는 별도 맵으로", () => {
    const { participants, noMicById } = toParticipants([
      player({
        battleTag: "학살#38848",
        noMic: true,
        ranks: {
          tank: { tier: "gold", division: 3, preferred: false, avoided: false },
        },
      }),
    ]);
    expect(participants[0].id).toBe("guest:학살#38848");
    expect(noMicById["guest:학살#38848"]).toBe(true);
    // 공유 타입에 noMic가 새지 않음
    expect("noMic" in participants[0]).toBe(false);
  });
});
