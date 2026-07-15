import { redirect } from "next/navigation";
import { getMyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PatchNotesClient } from "./patch-notes-client";

/**
 * 패치노트 작성·관리 (슈퍼관리자 전용).
 * 여기서 올린 글이 공개 게시판 /patch 와 디스코드 /패치노트(최신 1건)에 반영되고,
 * "디스코드 전송"으로 패치노트 채널이 설정된 서버에 직접 게시할 수 있다.
 */
export default async function PatchNotesAdminPage() {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) redirect("/app");

  const supabase = await createClient();
  const [posts, channels, sends] = await Promise.all([
    supabase
      .from("patch_posts")
      .select("id, title, body, published, created_at")
      .order("created_at", { ascending: false }),
    // 패치노트 채널 ID 가 지정된 서버만 전송 대상.
    supabase
      .from("channels")
      .select("id, name")
      .not("patch_channel_id", "is", null)
      .order("name"),
    supabase.from("patch_post_sends").select("post_id, channel_id, sent_at"),
  ]);

  return (
    <PatchNotesClient
      posts={posts.data ?? []}
      targets={channels.data ?? []}
      sends={sends.data ?? []}
    />
  );
}
