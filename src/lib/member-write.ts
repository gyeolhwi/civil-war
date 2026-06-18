import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleRating } from "@/app/app/members/schema";
import { ratingScore } from "@/constants/tiers";
import type { Division, Role, Tier } from "@/domain/types";

/**
 * 멤버 등록/수정 DB 쓰기 헬퍼 (세션·service-role 클라이언트 공용).
 *
 * 웹 멤버 관리(`members/actions.ts`)는 전체를 한 번에 교체하고,
 * 디스코드 `/등록` 위저드는 단계별(기본정보 → 영웅 → 맵)로 부분 저장하므로
 * 프로필 3종을 각각 독립 함수로 분리한다. 각 함수는 자기 영역만 교체한다.
 *
 * 클라이언트는 호출부가 주입한다:
 *   · 웹  → RLS 세션 클라이언트(`lib/supabase/server`)
 *   · 봇  → service-role 클라이언트(`lib/supabase/admin`, 세션 없음)
 * 따라서 채널 스코프(channel_id)는 반드시 호출부가 명시한다.
 */

export type WriteResult = { ok: true } | { ok: false; error: string };

export function mapMemberError(message?: string): string {
  if (!message) return "저장 중 오류가 발생했습니다";
  if (
    message.includes("members_battle_tag_key") ||
    message.includes("duplicate")
  ) {
    return "이미 등록된 배틀태그입니다";
  }
  return "저장 중 오류가 발생했습니다";
}

/**
 * 글로벌 members 행을 찾거나 만든다 (배틀태그 기준, SC-11).
 * 우선순위: memberId > battleTag > 신규.
 * discordUserId 는 멤버에 함께 기록하지만, 채널별로 다른 멤버에 연결될 수 있어
 * 전역으로 멤버를 찾는 키로는 쓰지 않는다(채널 스코프 조회는 호출부가 담당).
 */
export async function upsertMemberCore(
  sb: SupabaseClient,
  input: {
    memberId?: string | null;
    battleTag: string;
    discordName: string | null;
    discordUserId?: string | null;
  },
): Promise<{ ok: true; memberId: string } | { ok: false; error: string }> {
  let memberId = input.memberId ?? null;

  if (!memberId) {
    const { data } = await sb
      .from("members")
      .select("id, discord_user_id")
      .eq("battle_tag", input.battleTag)
      .maybeSingle();
    // 배틀태그가 이미 다른 디스코드 계정에 묶여 있으면 가로채기/중복 등록 차단.
    if (
      data &&
      input.discordUserId &&
      data.discord_user_id &&
      data.discord_user_id !== input.discordUserId
    ) {
      return {
        ok: false,
        error: "이 배틀태그는 다른 디스코드 계정에 연결돼 있어요.",
      };
    }
    memberId = data?.id ?? null;
  }

  const patch: Record<string, unknown> = {
    battle_tag: input.battleTag,
    discord_name: input.discordName,
  };
  if (input.discordUserId) patch.discord_user_id = input.discordUserId;

  if (memberId) {
    const { error } = await sb.from("members").update(patch).eq("id", memberId);
    if (error) return { ok: false, error: mapMemberError(error.message) };
    return { ok: true, memberId };
  }

  const { data, error } = await sb
    .from("members")
    .insert(patch)
    .select("id")
    .single();
  if (error || !data)
    return { ok: false, error: mapMemberError(error?.message) };
  return { ok: true, memberId: data.id as string };
}

/**
 * 채널 매핑 행만 보장 (있으면 그대로 둠 — 포지션 등 기존 값 보존).
 * 디스코드 등록에서 배틀태그 저장 시 행만 만들고, 포지션은 이후 셀렉트로 갱신한다.
 */
export async function ensureChannelMembership(
  sb: SupabaseClient,
  channelId: string,
  memberId: string,
): Promise<WriteResult> {
  const { error } = await sb
    .from("channel_members")
    .upsert(
      { channel_id: channelId, member_id: memberId },
      { onConflict: "channel_id,member_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: mapMemberError(error.message) };
  return { ok: true };
}

/** 채널 매핑 + 주/부 포지션 (현재 채널 것만, 다른 채널 불변 SC-13). */
export async function upsertChannelMembership(
  sb: SupabaseClient,
  channelId: string,
  memberId: string,
  roles: { primaryRole: Role | null; secondaryRole: Role | null },
): Promise<WriteResult> {
  const { error } = await sb.from("channel_members").upsert(
    {
      channel_id: channelId,
      member_id: memberId,
      primary_role: roles.primaryRole,
      secondary_role: roles.secondaryRole,
    },
    { onConflict: "channel_id,member_id" },
  );
  if (error) return { ok: false, error: mapMemberError(error.message) };
  return { ok: true };
}

/** 역할별 티어 — 현재 채널 것 전량 교체 (delete → insert). */
export async function replaceRoleRatings(
  sb: SupabaseClient,
  channelId: string,
  memberId: string,
  ratings: RoleRating[],
): Promise<WriteResult> {
  const ctx = { channel_id: channelId, member_id: memberId };
  await sb.from("member_role_ratings").delete().match(ctx);
  if (!ratings.length) return { ok: true };
  const rows = ratings.map((r) => ({
    ...ctx,
    role: r.role,
    tier: r.tier,
    division: r.division,
    rating_score: ratingScore(r.tier as Tier, r.division as Division),
  }));
  const { error } = await sb.from("member_role_ratings").insert(rows);
  if (error) return { ok: false, error: mapMemberError(error.message) };
  return { ok: true };
}

/**
 * 단일 역할 티어만 upsert (다른 역할 티어는 보존).
 * 디스코드 `/등록`은 주 포지션 티어만 받으므로, 웹에서 설정한 다른 역할
 * 티어를 지우지 않도록 전량 교체(replaceRoleRatings) 대신 이 함수를 쓴다.
 */
export async function upsertRoleRating(
  sb: SupabaseClient,
  channelId: string,
  memberId: string,
  role: Role,
  tier: Tier,
  division: Division,
): Promise<WriteResult> {
  const { error } = await sb.from("member_role_ratings").upsert(
    {
      channel_id: channelId,
      member_id: memberId,
      role,
      tier,
      division,
      rating_score: ratingScore(tier, division),
    },
    { onConflict: "channel_id,member_id,role" },
  );
  if (error) return { ok: false, error: mapMemberError(error.message) };
  return { ok: true };
}

/** 선호 영웅 — 현재 채널 것 전량 교체. */
export async function replaceHeroPrefs(
  sb: SupabaseClient,
  channelId: string,
  memberId: string,
  heroCodes: string[],
): Promise<WriteResult> {
  const ctx = { channel_id: channelId, member_id: memberId };
  await sb.from("member_hero_preferences").delete().match(ctx);
  if (!heroCodes.length) return { ok: true };
  const rows = heroCodes.map((hero_code) => ({ ...ctx, hero_code }));
  const { error } = await sb.from("member_hero_preferences").insert(rows);
  if (error) return { ok: false, error: mapMemberError(error.message) };
  return { ok: true };
}

/** 선호 맵 — 현재 채널 것 전량 교체. */
export async function replaceMapPrefs(
  sb: SupabaseClient,
  channelId: string,
  memberId: string,
  mapCodes: string[],
): Promise<WriteResult> {
  const ctx = { channel_id: channelId, member_id: memberId };
  await sb.from("member_map_preferences").delete().match(ctx);
  if (!mapCodes.length) return { ok: true };
  const rows = mapCodes.map((map_code) => ({ ...ctx, map_code }));
  const { error } = await sb.from("member_map_preferences").insert(rows);
  if (error) return { ok: false, error: mapMemberError(error.message) };
  return { ok: true };
}
