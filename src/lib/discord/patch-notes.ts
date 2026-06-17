import { getLatestPatchPost, type PatchSection } from "@/lib/patch-notes/load";

// "/패치노트" 슬래시 커맨드.
// 게시판(content/patch-notes/*.md)의 "최신 글 1건"을 섹션별 임베드로 채널에 공개 게시한다.
// (ephemeral 아님 → 모두에게 보이고 글로 남음). 글 추가/수정은 patch-note 스킬로.

const APP_COLOR = 0x5865f2; // 디스코드 블루 (내전 웹·봇)
const OVERWATCH_COLOR = 0xf99e1a; // 오버워치 주황 (공식 패치)

/** 섹션 제목으로 임베드 색을 고른다. */
function colorFor(heading: string): number {
  return heading.includes("오버워치") ? OVERWATCH_COLOR : APP_COLOR;
}

/** 섹션 → 디스코드 임베드. 마크다운(**굵게**·[링크])은 디스코드가 그대로 렌더. */
function sectionEmbed(s: PatchSection) {
  const lines = s.bullets.map((b) => `• ${b}`);
  if (s.note) lines.push(`\n${s.note}`);
  return {
    title: s.heading,
    color: colorFor(s.heading),
    description: lines.join("\n") || "_내용이 없어요._",
  };
}

/** `/패치노트` — 최신 글을 공개 게시. 글이 없으면 안내. */
export function handlePatchNotes() {
  const post = getLatestPatchPost();
  if (!post?.sections.length) {
    return {
      type: 4,
      data: {
        embeds: [
          {
            title: "📰 패치노트",
            description: "_아직 등록된 패치노트가 없어요._",
            color: APP_COLOR,
          },
        ],
      },
    };
  }

  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE (공개)
    data: {
      content: `📰 **패치노트 — ${post.title}** (${post.date})`,
      embeds: post.sections.map(sectionEmbed),
    },
  };
}
