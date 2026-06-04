import type { SupabaseClient } from "@supabase/supabase-js";
import type { Division, Role, Tier } from "@/domain/types";
import { createClient } from "@/lib/supabase/server";

export interface RoleRating {
  tier: Tier;
  division: Division;
  score: number;
}

export interface MemberProfile {
  memberId: string;
  battleTag: string;
  discordName: string | null;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  /** 역할별 티어 (입력된 역할만) */
  ratings: Partial<Record<Role, RoleRating>>;
  /** 선호 영웅 코드 (최대 5) */
  heroCodes: string[];
  /** 선호 맵 코드 */
  mapCodes: string[];
}

/**
 * 한 멤버의 채널별 프로필(티어·주/부 포지션·선호 영웅/맵)을 로드.
 * `client`를 주면 그 클라이언트로(공개 검색은 admin), 없으면 세션 클라이언트로 조회한다.
 * 항상 channel_id + member_id 로 스코프한다.
 */
export async function loadMemberProfile(
  channelId: string,
  memberId: string,
  client?: SupabaseClient,
): Promise<MemberProfile | null> {
  const supabase = client ?? (await createClient());

  const { data: link } = await supabase
    .from("channel_members")
    .select("primary_role, secondary_role")
    .eq("channel_id", channelId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!link) return null;

  const [
    { data: member },
    { data: ratings },
    { data: heroes },
    { data: maps },
  ] = await Promise.all([
    supabase
      .from("members")
      .select("battle_tag, discord_name")
      .eq("id", memberId)
      .maybeSingle(),
    supabase
      .from("member_role_ratings")
      .select("role, tier, division, rating_score")
      .eq("channel_id", channelId)
      .eq("member_id", memberId),
    supabase
      .from("member_hero_preferences")
      .select("hero_code")
      .eq("channel_id", channelId)
      .eq("member_id", memberId),
    supabase
      .from("member_map_preferences")
      .select("map_code")
      .eq("channel_id", channelId)
      .eq("member_id", memberId),
  ]);

  const ratingMap: Partial<Record<Role, RoleRating>> = {};
  for (const r of ratings ?? []) {
    ratingMap[r.role as Role] = {
      tier: r.tier as Tier,
      division: r.division as Division,
      score: r.rating_score as number,
    };
  }

  return {
    memberId,
    battleTag: member?.battle_tag ?? "(알 수 없음)",
    discordName: member?.discord_name ?? null,
    primaryRole: (link.primary_role as Role | null) ?? null,
    secondaryRole: (link.secondary_role as Role | null) ?? null,
    ratings: ratingMap,
    heroCodes: (heroes ?? []).map((h) => h.hero_code as string),
    mapCodes: (maps ?? []).map((mp) => mp.map_code as string),
  };
}

/**
 * 채널의 모든 멤버 프로필을 한 번에 로드 (개인 전적 탭에서 멤버 전환 시 사용).
 * memberId → MemberProfile 맵.
 */
export async function loadMemberProfiles(
  channelId: string,
  client?: SupabaseClient,
): Promise<Record<string, MemberProfile>> {
  const supabase = client ?? (await createClient());

  const { data: links } = await supabase
    .from("channel_members")
    .select("member_id, primary_role, secondary_role")
    .eq("channel_id", channelId);
  if (!links || links.length === 0) return {};

  const memberIds = links.map((l) => l.member_id);

  const [
    { data: members },
    { data: ratings },
    { data: heroes },
    { data: maps },
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id, battle_tag, discord_name")
      .in("id", memberIds),
    supabase
      .from("member_role_ratings")
      .select("member_id, role, tier, division, rating_score")
      .eq("channel_id", channelId),
    supabase
      .from("member_hero_preferences")
      .select("member_id, hero_code")
      .eq("channel_id", channelId),
    supabase
      .from("member_map_preferences")
      .select("member_id, map_code")
      .eq("channel_id", channelId),
  ]);

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const out: Record<string, MemberProfile> = {};

  for (const link of links) {
    const m = memberById.get(link.member_id);
    const ratingMap: Partial<Record<Role, RoleRating>> = {};
    for (const r of ratings ?? []) {
      if (r.member_id !== link.member_id) continue;
      ratingMap[r.role as Role] = {
        tier: r.tier as Tier,
        division: r.division as Division,
        score: r.rating_score as number,
      };
    }
    out[link.member_id] = {
      memberId: link.member_id,
      battleTag: m?.battle_tag ?? "(알 수 없음)",
      discordName: m?.discord_name ?? null,
      primaryRole: (link.primary_role as Role | null) ?? null,
      secondaryRole: (link.secondary_role as Role | null) ?? null,
      ratings: ratingMap,
      heroCodes: (heroes ?? [])
        .filter((h) => h.member_id === link.member_id)
        .map((h) => h.hero_code as string),
      mapCodes: (maps ?? [])
        .filter((mp) => mp.member_id === link.member_id)
        .map((mp) => mp.map_code as string),
    };
  }

  return out;
}
