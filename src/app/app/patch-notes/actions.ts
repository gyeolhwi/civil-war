"use server";

import { revalidatePath } from "next/cache";
import { getMyAdmin } from "@/lib/admin";
import { sendPatchToChannel } from "@/lib/discord/patch-broadcast";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  patchPostSchema,
  type SendResult,
  type SendTargetResult,
  sendPatchSchema,
} from "./schema";

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

/** 패치노트 글 수정 (슈퍼관리자 전용). */
export async function updatePatchPost(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
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
    .update({ title: v.title, body: v.body, published: v.published })
    .eq("id", id);
  if (error) return { ok: false, error: "수정 중 오류가 발생했습니다" };

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

/**
 * 패치노트를 디스코드로 전송 (슈퍼관리자 전용).
 * target="all" 이면 patch_channel_id 가 설정된 모든 서버, uuid 면 그 서버 1곳.
 * 이미 보낸 서버는 건너뛴다(force=true 면 재전송). 한 서버가 실패해도 나머지는 계속 보내고,
 * 서버별 결과를 그대로 돌려준다 — 어디가 왜 실패했는지 UI 에서 보여주기 위함.
 */
export async function sendPatchPostToDiscord(
  raw: unknown,
): Promise<SendResult> {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) return { ok: false, error: "슈퍼관리자만 가능합니다" };

  const parsed = sendPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const { postId, target, force } = parsed.data;

  const supabase = await createClient();

  const { data: post } = await supabase
    .from("patch_posts")
    .select("title, body, published, created_at")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, error: "글을 찾을 수 없습니다" };
  if (!post.published) {
    return {
      ok: false,
      error: "비공개 글은 전송할 수 없어요. 먼저 '게시(공개)'로 바꿔주세요",
    };
  }

  let query = supabase
    .from("channels")
    .select("id, name, patch_channel_id")
    .not("patch_channel_id", "is", null);
  if (target !== "all") query = query.eq("id", target);
  const { data: channels } = await query.order("name");

  if (!channels?.length) {
    return {
      ok: false,
      error:
        target === "all"
          ? "패치노트 채널 ID가 설정된 서버가 없어요. 관리자 → 채널 설정에서 지정해주세요"
          : "이 서버에는 패치노트 채널 ID가 설정돼 있지 않아요",
    };
  }

  const { data: sends } = await supabase
    .from("patch_post_sends")
    .select("channel_id")
    .eq("post_id", postId);
  const alreadySent = new Set((sends ?? []).map((s) => s.channel_id as string));

  const results: SendTargetResult[] = [];
  for (const ch of channels) {
    const channelId = ch.id as string;
    const channelName = ch.name as string;

    if (alreadySent.has(channelId) && !force) {
      results.push({ channelId, channelName, status: "skipped" });
      continue;
    }

    try {
      const messageIds = await sendPatchToChannel(
        ch.patch_channel_id as string,
        post as { title: string; body: string; created_at: string },
      );
      const { error } = await supabase.from("patch_post_sends").upsert(
        {
          post_id: postId,
          channel_id: channelId,
          discord_channel_id: ch.patch_channel_id as string,
          discord_message_ids: messageIds,
          sent_at: new Date().toISOString(),
        },
        { onConflict: "post_id,channel_id" },
      );
      results.push(
        error
          ? {
              channelId,
              channelName,
              status: "failed",
              error: "디스코드엔 올라갔지만 전송 이력 저장에 실패했어요",
            }
          : { channelId, channelName, status: "sent" },
      );
    } catch (e) {
      results.push({
        channelId,
        channelName,
        status: "failed",
        error: e instanceof Error ? e.message : "전송에 실패했어요",
      });
    }
  }

  revalidatePath("/app/patch-notes");
  return { ok: true, results };
}
