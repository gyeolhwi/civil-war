import { redirect } from "next/navigation";
import { getMyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PatchNotesClient } from "./patch-notes-client";

/**
 * 패치노트 작성·관리 (슈퍼관리자 전용).
 * 여기서 올린 글이 공개 게시판 /patch 와 디스코드 /패치노트(최신 1건)에 반영된다.
 */
export default async function PatchNotesAdminPage() {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) redirect("/app");

  const supabase = await createClient();
  const { data } = await supabase
    .from("patch_posts")
    .select("id, title, body, published, created_at")
    .order("created_at", { ascending: false });

  return <PatchNotesClient posts={data ?? []} />;
}
