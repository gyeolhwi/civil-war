import { describe, expect, it } from "vitest";
import { buildDiscordText, type ShareTeam } from "./discord";

const teamA: ShareTeam = {
  label: "A팀",
  finalScore: 23450,
  members: [
    { battleTag: "홍길동#1", role: "tank", heroCode: "rein" },
    { battleTag: "이순신#2", role: "dps" },
    { battleTag: "장보고#3", role: "dps" },
    { battleTag: "유관순#4", role: "support" },
    { battleTag: "안중근#5", role: "support" },
  ],
};

const teamB: ShareTeam = {
  label: "B팀",
  finalScore: 23120,
  members: [
    { battleTag: "김홍도#6", role: "tank" },
    { battleTag: "장영실#7", role: "dps" },
    { battleTag: "세종#8", role: "dps" },
    { battleTag: "이이#9", role: "support" },
    { battleTag: "이황#10", role: "support" },
  ],
};

describe("buildDiscordText", () => {
  it("양 팀 라벨·점수·배틀태그를 포함한다", () => {
    const text = buildDiscordText({ teamA, teamB });
    expect(text).toContain("A팀 (23,450)");
    expect(text).toContain("B팀 (23,120)");
    expect(text).toContain("홍길동#1");
    expect(text).toContain("이황#10");
  });

  it("영웅 코드는 한글 이름으로 표시한다", () => {
    const text = buildDiscordText({ teamA, teamB });
    expect(text).toContain("홍길동#1 (라인하르트)");
  });

  it("맵과 밴이 있으면 푸터에 포함한다", () => {
    const text = buildDiscordText({
      teamA,
      teamB,
      mapCode: "kings_row",
      banA: "tracer",
      banB: "genji",
    });
    expect(text).toMatch(/🗺️ .+/);
    expect(text).toMatch(/🚫 /);
  });

  it("맵·밴이 없으면 푸터를 생략한다", () => {
    const text = buildDiscordText({ teamA, teamB });
    expect(text).not.toContain("🗺️");
    expect(text).not.toContain("🚫");
  });
});
