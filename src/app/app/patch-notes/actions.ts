"use server";

import { revalidatePath } from "next/cache";
import { getMyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, patchPostSchema } from "./schema";

/** 패치노트 글 작성 (슈퍼관리자 전용). RLS(is_super)가 1차, getMyAdmin이 2차 방어. */
export async function createPatchPost(raw: unknown): Promise<ActionResult> {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) return { ok: false, error: "슈퍼관리자만 가능합니다" };

  const parsed = patchPostSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("patch_posts")
    .insert({ title: v.title, body: v.body, published: v.published });
  if (error) return { ok: false, error: "저장 중 오류가 발생했습니다" };

  revalidatePath("/app/patch-notes");
  revalidatePath("/patch");
  return { ok: true };
}

/** 패치노트 글 삭제 (슈퍼관리자 전용). */
export async function deletePatchPost(id: string): Promise<ActionResult> {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) return { ok: false, error: "슈퍼관리자만 가능합니다" };

  const supabase = await createClient();
  const { error } = await supabase.from("patch_posts").delete().eq("id", id);
  if (error) return { ok: false, error: "삭제 중 오류가 발생했습니다" };

  revalidatePath("/app/patch-notes");
  revalidatePath("/patch");
  return { ok: true };
}
