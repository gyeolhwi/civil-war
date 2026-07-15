import { describe, expect, it } from "vitest";
import { parseLineToPlayer, parseMultipleLines } from "./parser";

describe("parseLineToPlayer", () => {
  it("슬래시 형식 (탱/딜/힐 순서)", () => {
    const p = parseLineToPlayer("테스터1#11853 다5/다1/다5");
    expect(p).not.toBeNull();
    expect(p?.battleTag).toBe("테스터1#11853");
    expect(p?.ranks.tank).toEqual({
      tier: "diamond",
      division: 5,
      preferred: false,
      avoided: false,
    });
    expect(p?.ranks.dps?.division).toBe(1);
    expect(p?.ranks.support?.tier).toBe("diamond");
  });

  it("선호(!) 마커 → preferred", () => {
    const p = parseLineToPlayer("재봉이#31207 그5!/마1!/마4");
    expect(p?.ranks.tank).toEqual({
      tier: "grandmaster",
      division: 5,
      preferred: true,
      avoided: false,
    });
    expect(p?.ranks.dps?.preferred).toBe(true);
    expect(p?.ranks.support?.preferred).toBe(false);
  });

  it("비선호(?) 마커 → avoided", () => {
    const p = parseLineToPlayer("Test#1234 다3/플2?/골1");
    expect(p?.ranks.dps).toEqual({
      tier: "platinum",
      division: 2,
      preferred: false,
      avoided: true,
    });
  });

  it("미배치(예상티어) → 예상 티어 div3", () => {
    const p = parseLineToPlayer("Aki#34981 미배치(골)/미배치(플)/플2");
    expect(p?.ranks.tank).toEqual({
      tier: "gold",
      division: 3,
      preferred: false,
      avoided: false,
    });
    expect(p?.ranks.dps?.tier).toBe("platinum");
    expect(p?.ranks.support?.division).toBe(2);
  });

  it("역할 라벨이 붙은 공백 형식", () => {
    const p = parseLineToPlayer(
      "Soldier#1234 탱커 다이아3 딜러 플레4 힐러 마스터5",
    );
    expect(p?.ranks.tank?.tier).toBe("diamond");
    expect(p?.ranks.tank?.division).toBe(3);
    expect(p?.ranks.dps?.tier).toBe("platinum");
    expect(p?.ranks.support?.tier).toBe("master");
  });

  it("끝 X 표기 → noMic", () => {
    const p = parseLineToPlayer("학살#38848 다3/마4/다4 X");
    expect(p?.noMic).toBe(true);
    expect(p?.ranks.dps?.tier).toBe("master");
  });

  it("끝 O 표기 → 마이크 사용", () => {
    const p = parseLineToPlayer("학살#38848 다3/마4/다4 O");
    expect(p?.noMic).toBe(false);
  });

  it("배틀태그 없으면 null", () => {
    expect(parseLineToPlayer("다5/다1/다5")).toBeNull();
  });

  it("티어를 하나도 못 읽으면 null", () => {
    expect(parseLineToPlayer("Nobody#9999 안녕하세요")).toBeNull();
  });
});

describe("parseMultipleLines", () => {
  it("여러 줄 파싱 + 실패 줄 분리", () => {
    const text = [
      "테스터1#11853 다5/다1/다5",
      "학살#38848 다3/마4/다4",
      "이상한사람#0001 불참",
    ].join("\n");
    const { players, failedLines } = parseMultipleLines(text);
    expect(players).toHaveLength(2);
    expect(failedLines).toEqual(["이상한사람#0001"]);
  });

  it("닉네임 다음 줄에 티어가 오는 형식", () => {
    const text = "Kim#1111\n다5/다1/다5";
    const { players } = parseMultipleLines(text);
    expect(players).toHaveLength(1);
    expect(players[0].battleTag).toBe("Kim#1111");
    expect(players[0].ranks.tank?.tier).toBe("diamond");
  });

  it("중복 배틀태그는 한 번만", () => {
    const text = "Kim#1111 다5/다1/다5\nKIM#1111 마5/마5/마5";
    const { players } = parseMultipleLines(text);
    expect(players).toHaveLength(1);
    expect(players[0].ranks.tank?.tier).toBe("diamond");
  });
});
