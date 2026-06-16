"use server";

import { revalidatePath } from "next/cache";
import { getMyAdmin } from "@/lib/admin";
import { getAalState } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  channelCreateSchema,
  channelUpdateSchema,
  memberDiscordSchema,
} from "./schema";

/** 슈퍼관리자 + 2단계 인증(AAL2) 가드 — 아니면 거부. */
async function ensureSuper(): Promise<ActionResult | null> {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) return { ok: false, error: "권한이 없습니다" };
  const { currentLevel } = await getAalState();
  if (currentLevel !== "aal2") {
    return { ok: false, error: "2단계 인증이 필요합니다" };
  }
  return null;
}

function mapChannelError(message?: string): string {
  if (!message) return "저장 중 오류가 발생했습니다";
  if (message.includes("channels_discord_guild_id_key")) {
    return "이미 다른 채널에 연결된 디스코드 서버(길드) ID입니다";
  }
  if (message.includes("channels_discord_channel_id_key")) {
    return "이미 다른 채널에 연결된 디스코드 채널 ID입니다";
  }
  return "저장 중 오류가 발생했습니다";
}

/** 채널 생성 (수동 연결). 길드/채널 ID·소유 관리자는 선택. */
export async function createChannel(raw: unknown): Promise<ActionResult> {
  const denied = await ensureSuper();
  if (denied) return denied;

  const parsed = channelCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("channels").insert({
    name: v.name,
    discord_guild_id: v.discordGuildId,
    discord_channel_id: v.discordChannelId,
    owner_admin_id: v.ownerAdminId,
  });
  if (error) return { ok: false, error: mapChannelError(error.message) };

  revalidatePath("/admin");
  return { ok: true };
}

/** 채널 설정 수정 (이름·디스코드 ID·소유 관리자). */
export async function updateChannel(raw: unknown): Promise<ActionResult> {
  const denied = await ensureSuper();
  if (denied) return denied;

  const parsed = channelUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("channels")
    .update({
      name: v.name,
      discord_guild_id: v.discordGuildId,
      discord_channel_id: v.discordChannelId,
      owner_admin_id: v.ownerAdminId,
    })
    .eq("id", v.channelId);
  if (error) return { ok: false, error: mapChannelError(error.message) };

  revalidatePath("/admin");
  revalidatePath(`/admin/channels/${v.channelId}`);
  return { ok: true };
}

/** 멤버의 디스코드 사용자 ID 연결/해제 (빈 값이면 해제). */
export async function setMemberDiscordId(raw: unknown): Promise<ActionResult> {
  const denied = await ensureSuper();
  if (denied) return denied;

  const parsed = memberDiscordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ discord_user_id: v.discordUserId })
    .eq("id", v.memberId);
  if (error) {
    if (error.message.includes("members_discord_user_id_key")) {
      return { ok: false, error: "이미 다른 멤버에 연결된 디스코드 ID입니다" };
    }
    return { ok: false, error: "저장 중 오류가 발생했습니다" };
  }

  revalidatePath("/admin");
  return { ok: true };
}
