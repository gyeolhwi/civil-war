"use server";

import { revalidatePath } from "next/cache";
import { ratingScore } from "@/constants/tiers";
import type { Division, Tier } from "@/domain/types";
import { getMyChannel } from "@/lib/channel";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, memberFormSchema } from "./schema";

/**
 * 멤버 등록/수정 (F3·F4). 채널 컨텍스트를 서버에서 강제 (erd §5 단순화 방침).
 * - members: 배틀태그로 글로벌 조회 후 재사용, 없으면 신규 (SC-11)
 * - channel_members / 프로필 3종: 현재 채널 것만 전량 교체 (다른 채널 불변, SC-13)
 */
export async function saveMember(raw: unknown): Promise<ActionResult> {
  const parsed = memberFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const channel = await getMyChannel();
  if (!channel) return { ok: false, error: "배정된 채널이 없습니다" };

  const supabase = await createClient();
  const discordName = v.discordName?.trim() || null;

  // 1. 글로벌 members upsert (배틀태그 기준)
  let memberId = v.memberId ?? null;
  if (!memberId) {
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("battle_tag", v.battleTag)
      .maybeSingle();
    memberId = existing?.id ?? null;
  }

  if (memberId) {
    const { error } = await supabase
      .from("members")
      .update({ battle_tag: v.battleTag, discord_name: discordName })
      .eq("id", memberId);
    if (error) return { ok: false, error: mapError(error.message) };
  } else {
    const { data, error } = await supabase
      .from("members")
      .insert({ battle_tag: v.battleTag, discord_name: discordName })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: mapError(error?.message) };
    memberId = data.id;
  }

  // 2. channel_members upsert (현재 채널 매핑 + 주/부 포지션)
  const { error: cmError } = await supabase.from("channel_members").upsert(
    {
      channel_id: channel.id,
      member_id: memberId,
      primary_role: v.primaryRole ?? null,
      secondary_role: v.secondaryRole ?? null,
    },
    { onConflict: "channel_id,member_id" },
  );
  if (cmError) return { ok: false, error: mapError(cmError.message) };

  // 3. 프로필 3종 — 현재 채널 것만 교체 (delete → insert)
  const ctx = { channel_id: channel.id, member_id: memberId };

  await supabase.from("member_role_ratings").delete().match(ctx);
  if (v.ratings.length) {
    const rows = v.ratings.map((r) => ({
      ...ctx,
      role: r.role,
      tier: r.tier,
      division: r.division,
      rating_score: ratingScore(r.tier as Tier, r.division as Division),
    }));
    const { error } = await supabase.from("member_role_ratings").insert(rows);
    if (error) return { ok: false, error: mapError(error.message) };
  }

  await supabase.from("member_hero_preferences").delete().match(ctx);
  if (v.heroCodes.length) {
    const rows = v.heroCodes.map((hero_code) => ({ ...ctx, hero_code }));
    const { error } = await supabase
      .from("member_hero_preferences")
      .insert(rows);
    if (error) return { ok: false, error: mapError(error.message) };
  }

  await supabase.from("member_map_preferences").delete().match(ctx);
  if (v.mapCodes.length) {
    const rows = v.mapCodes.map((map_code) => ({ ...ctx, map_code }));
    const { error } = await supabase
      .from("member_map_preferences")
      .insert(rows);
    if (error) return { ok: false, error: mapError(error.message) };
  }

  revalidatePath("/app/members");
  return { ok: true };
}

/**
 * 멤버 삭제 (SC-14): 현재 채널 매핑·프로필만 제거.
 * 글로벌 members 행과 과거 매치 기록(team_members, FK RESTRICT)은 보존.
 */
export async function deleteMember(memberId: string): Promise<ActionResult> {
  const channel = await getMyChannel();
  if (!channel) return { ok: false, error: "배정된 채널이 없습니다" };

  const supabase = await createClient();
  const ctx = { channel_id: channel.id, member_id: memberId };

  // 프로필 → 매핑 순으로 삭제 (CASCADE에 의존하지 않고 명시)
  await supabase.from("member_role_ratings").delete().match(ctx);
  await supabase.from("member_hero_preferences").delete().match(ctx);
  await supabase.from("member_map_preferences").delete().match(ctx);
  const { error } = await supabase.from("channel_members").delete().match(ctx);
  if (error) return { ok: false, error: mapError(error.message) };

  revalidatePath("/app/members");
  return { ok: true };
}

function mapError(message?: string): string {
  if (!message) return "저장 중 오류가 발생했습니다";
  if (
    message.includes("members_battle_tag_key") ||
    message.includes("duplicate")
  ) {
    return "이미 이 채널에 등록된 배틀태그입니다";
  }
  return "저장 중 오류가 발생했습니다";
}
