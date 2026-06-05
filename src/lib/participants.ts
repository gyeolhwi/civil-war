import type { Participant } from "@/domain/team-builder";
import type { Role } from "@/domain/types";
import { getRefData } from "@/lib/ref-data";
import { createClient } from "@/lib/supabase/server";

/**
 * 채널의 전체 멤버를 팀 빌딩용 Participant 형태로 로드.
 * 멤버 관리 화면 로더와 동일 패턴이나, 배정에 필요한 rating_score·맵 선호까지 포함.
 */
export async function loadParticipants(
  channelId: string,
): Promise<Participant[]> {
  const supabase = await createClient();
  const { heroByCode } = await getRefData();

  const { data: links } = await supabase
    .from("channel_members")
    .select("member_id, primary_role, secondary_role, joined_at")
    .eq("channel_id", channelId)
    .order("joined_at", { ascending: true });

  if (!links || links.length === 0) return [];

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
      .select("member_id, role, rating_score")
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

  return links.map((link) => {
    const m = memberById.get(link.member_id);
    const ratingMap: Partial<Record<Role, number>> = {};
    for (const r of ratings ?? []) {
      if (r.member_id === link.member_id) {
        ratingMap[r.role as Role] = r.rating_score as number;
      }
    }
    return {
      id: link.member_id,
      battleTag: m?.battle_tag ?? "(알 수 없음)",
      discordName: m?.discord_name ?? null,
      primaryRole: (link.primary_role as Role | null) ?? null,
      secondaryRole: (link.secondary_role as Role | null) ?? null,
      ratings: ratingMap,
      heroCodes: (heroes ?? [])
        .filter((h) => h.member_id === link.member_id)
        .map((h) => h.hero_code as string),
      heroes: (heroes ?? [])
        .filter((h) => h.member_id === link.member_id)
        .map((h) => heroByCode[h.hero_code as string])
        .filter((h): h is NonNullable<typeof h> => h != null),
      mapCodes: (maps ?? [])
        .filter((mp) => mp.member_id === link.member_id)
        .map((mp) => mp.map_code as string),
    } satisfies Participant;
  });
}
