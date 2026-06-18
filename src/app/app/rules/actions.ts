"use server";

import { revalidatePath } from "next/cache";
import { getMyChannel } from "@/lib/channel";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** 내 채널의 내전 규칙 저장 (채널 관리자 전용 — RLS owns_channel). */
export async function saveChannelRules(body: string): Promise<ActionResult> {
  const channel = await getMyChannel();
  if (!channel) return { ok: false, error: "배정된 채널이 없습니다" };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "규칙 내용을 입력하세요" };
  if (trimmed.length > 10000)
    return { ok: false, error: "규칙이 너무 깁니다 (최대 10000자)" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("channel_rules")
    .upsert(
      { channel_id: channel.id, body: trimmed },
      { onConflict: "channel_id" },
    );
  if (error) return { ok: false, error: "저장 중 오류가 발생했습니다" };

  revalidatePath("/app/rules");
  revalidatePath("/app/match/new");
  return { ok: true };
}
