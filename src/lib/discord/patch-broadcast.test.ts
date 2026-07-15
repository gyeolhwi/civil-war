import { describe, expect, it } from "vitest";
import { buildPatchMessages, splitBody } from "./patch-broadcast";

describe("splitBody", () => {
  it("한도 이하면 그대로 한 덩어리", () => {
    expect(splitBody("짧은 본문", 100)).toEqual(["짧은 본문"]);
  });

  it("줄 경계에서 끊는다 (불릿이 쪼개지지 않게)", () => {
    const body = ["• 아", "• 이", "• 우"].join("\n");
    // "• 아\n• 이" = 7자, 여기에 "\n• 우" 를 더하면 11자 → 한도 8 초과
    expect(splitBody(body, 8)).toEqual(["• 아\n• 이", "• 우"]);
  });

  it("한 줄이 통째로 한도를 넘으면 그 줄만 강제로 자른다", () => {
    expect(splitBody("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("긴 줄 앞에 쌓인 내용을 잃지 않는다", () => {
    const chunks = splitBody(`짧음\n${"x".repeat(10)}`, 4);
    expect(chunks).toEqual(["짧음", "xxxx", "xxxx", "xx"]);
    expect(chunks.join("")).toContain("짧음");
  });

  it("모든 덩어리가 한도 이하이고 내용이 보존된다", () => {
    const body = Array.from({ length: 500 }, (_, i) => `• 항목 ${i}`).join(
      "\n",
    );
    const chunks = splitBody(body, 4000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(4000);
    // 줄 경계에서만 끊었으므로 다시 이으면 원본과 같다.
    expect(chunks.join("\n")).toBe(body);
  });
});

describe("buildPatchMessages", () => {
  it("짧은 글은 메시지 1개 — 제목과 푸터가 함께 붙는다", () => {
    const [msg, ...rest] = buildPatchMessages("제목", "본문", "2026-07-15") as {
      embeds: { title?: string; description: string; footer?: unknown }[];
    }[];
    expect(rest).toHaveLength(0);
    expect(msg.embeds[0].title).toBe("📰 제목");
    expect(msg.embeds[0].description).toBe("본문");
    expect(msg.embeds[0].footer).toEqual({ text: "패치노트 · 2026-07-15" });
  });

  it("긴 글은 여러 메시지로 나뉘고, 제목은 첫 개·푸터는 마지막 개에만", () => {
    const body = Array.from({ length: 3000 }, (_, i) => `줄 ${i}`).join("\n");
    const msgs = buildPatchMessages("제목", body, "2026-07-15") as {
      embeds: { title?: string; description: string; footer?: unknown }[];
    }[];
    expect(msgs.length).toBeGreaterThan(1);

    expect(msgs[0].embeds[0].title).toBe("📰 제목");
    expect(msgs[0].embeds[0].footer).toBeUndefined();

    const last = msgs[msgs.length - 1];
    expect(last.embeds[0].title).toBeUndefined();
    expect(last.embeds[0].footer).toEqual({ text: "패치노트 · 2026-07-15" });

    // 본문 전체가 디스코드에 보여야 한다 — 잘려나간 부분이 없어야 함.
    expect(msgs.map((m) => m.embeds[0].description).join("\n")).toBe(body);
  });
});
