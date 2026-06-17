import { createAdminClient } from "@/lib/supabase/admin";

// "/패치노트" 슬래시 커맨드.
// 게시판(patch_posts 테이블)의 "최신 published 글 1건"을 채널에 공개 게시한다.
// (ephemeral 아님 → 모두에게 보이고 글로 남음). 글은 웹(/app/patch-notes)에서 작성.

const APP_COLOR = 0x5865f2;
const MAX_DESC = 4000; // 디스코드 임베드 description 한도(4096) 여유

/** `/패치노트` — 최신 글을 공개 게시. 글이 없으면 안내. */
export async function handlePatchNotes() {
  let post: { title: string; body: string; created_at: string } | null = null;
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("patch_posts")
      .select("title, body, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    post = data;
  } catch {
    // 환경/DB 문제 시 아래 안내로 폴백
  }

  if (!post) {
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

  const date = post.created_at.slice(0, 10);
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE (공개)
    data: {
      embeds: [
        {
          title: `📰 ${post.title}`,
          description: post.body.slice(0, MAX_DESC),
          color: APP_COLOR,
          footer: { text: `패치노트 · ${date}` },
        },
      ],
    },
  };
}
