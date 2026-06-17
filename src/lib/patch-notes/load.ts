import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 패치노트 "게시판" 로더.
 * 글은 마크다운 파일(`content/patch-notes/*.md`)이 단일 출처(source of truth)다.
 * - 디스코드 `/패치노트` = 최신 글 1건을 임베드로 게시
 * - 웹 게시판 `/patch` = 전체 글을 최신순으로 열람
 * 새 글은 patch-note 스킬(`pnpm`/Skill)이 이 폴더에 생성한다.
 *
 * 마크다운 포맷:
 *   ---
 *   title: ...
 *   date: YYYY-MM-DD
 *   ---
 *   ## 🎮 오버워치 공식 패치
 *   - 항목
 *   > 출처: [라벨](url) · [라벨](url)
 *   ## 🛠️ 내전 웹·봇 업데이트
 *   - 항목
 */

export interface PatchSection {
  /** 섹션 제목 (예: "🎮 오버워치 공식 패치"). */
  heading: string;
  /** 불릿 항목 (마크다운 — `**굵게**`·`[링크](url)` 그대로). */
  bullets: string[];
  /** 출처/주석 줄 (`>` 인용). 마크다운 링크 포함 가능. */
  note?: string;
}

export interface PatchPost {
  /** 파일명(확장자 제외) — 안정적 식별자. */
  slug: string;
  title: string;
  /** "YYYY-MM-DD". */
  date: string;
  sections: PatchSection[];
}

const CONTENT_DIR = join(process.cwd(), "content", "patch-notes");

function parsePost(slug: string, raw: string): PatchPost {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const body = fm ? raw.slice(fm[0].length) : raw;

  const sections: PatchSection[] = [];
  let current: PatchSection | null = null;
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t.startsWith("## ")) {
      current = { heading: t.slice(3).trim(), bullets: [] };
      sections.push(current);
    } else if (!current) {
      // 첫 ## 이전 내용은 무시
    } else if (t.startsWith("- ")) {
      current.bullets.push(t.slice(2).trim());
    } else if (t.startsWith(">")) {
      current.note = t.replace(/^>\s*/, "").trim();
    }
  }

  return {
    slug,
    title: meta.title ?? slug,
    date: meta.date ?? slug.slice(0, 10),
    sections,
  };
}

/** 전체 패치 글을 최신순(date 내림차순)으로. 폴더가 없거나 비면 빈 배열. */
export function getAllPatchPosts(): PatchPost[] {
  let files: string[];
  try {
    files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  return files
    .map((f) =>
      parsePost(
        f.replace(/\.md$/, ""),
        readFileSync(join(CONTENT_DIR, f), "utf8"),
      ),
    )
    .sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? 1 : -1,
    );
}

/** 가장 최신 글 1건 (없으면 null). */
export function getLatestPatchPost(): PatchPost | null {
  return getAllPatchPosts()[0] ?? null;
}
