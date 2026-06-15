"use server";

import { revalidatePath } from "next/cache";
import { getMyChannel } from "@/lib/channel";
import {
  mapMemberError,
  replaceHeroPrefs,
  replaceMapPrefs,
  replaceRoleRatings,
  upsertChannelMembership,
  upsertMemberCore,
} from "@/lib/member-write";
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
  const core = await upsertMemberCore(supabase, {
    memberId: v.memberId,
    battleTag: v.battleTag,
    discordName,
  });
  if (!core.ok) return core;
  const memberId = core.memberId;

  // 2. channel_members upsert (현재 채널 매핑 + 주/부 포지션)
  const cm = await upsertChannelMembership(supabase, channel.id, memberId, {
    primaryRole: v.primaryRole ?? null,
    secondaryRole: v.secondaryRole ?? null,
  });
  if (!cm.ok) return cm;

  // 3. 프로필 3종 — 현재 채널 것만 교체 (delete → insert)
  const r1 = await replaceRoleRatings(
    supabase,
    channel.id,
    memberId,
    v.ratings,
  );
  if (!r1.ok) return r1;
  const r2 = await replaceHeroPrefs(
    supabase,
    channel.id,
    memberId,
    v.heroCodes,
  );
  if (!r2.ok) return r2;
  const r3 = await replaceMapPrefs(supabase, channel.id, memberId, v.mapCodes);
  if (!r3.ok) return r3;

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
  if (error) return { ok: false, error: mapMemberError(error.message) };

  revalidatePath("/app/members");
  return { ok: true };
}
