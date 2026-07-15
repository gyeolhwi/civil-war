import type { Role } from "@/domain/types";
import { createClient } from "@/lib/supabase/server";

/**
 * 슈퍼관리자 관제 콘솔(/admin) 전용 읽기 헬퍼.
 *
 * 모든 쿼리는 로그인한 슈퍼관리자의 RLS 세션 클라이언트로 실행한다.
 * is_super() 가 owns_channel/channels 정책을 통과시키므로 전체 채널이 노출되고,
 * 별도 service-role 없이도 모든 채널을 관제할 수 있다.
 * (호출부 page 에서 getMyAdmin().isSuper 가드 후 사용한다)
 */

export interface ChannelOverview {
  id: string;
  name: string;
  discordGuildId: string | null;
  discordChannelId: string | null;
  ownerAdminId: string | null;
  ownerName: string | null;
  memberCount: number;
  matchCount: number;
}

export interface AdminOption {
  id: string;
  label: string;
}

export interface ChannelMemberRow {
  id: string;
  battleTag: string;
  discordName: string | null;
  discordUserId: string | null;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  ratings: { role: Role; tier: string; division: number }[];
}

export interface ChannelDetail {
  id: string;
  name: string;
  discordGuildId: string | null;
  discordChannelId: string | null;
  ownerAdminId: string | null;
  ownerName: string | null;
  voiceChannelAId: string | null;
  voiceChannelBId: string | null;
  patchChannelId: string | null;
  members: ChannelMemberRow[];
}

function adminLabel(a: {
  username: string;
  display_name: string | null;
}): string {
  return a.display_name?.trim() || a.username;
}

/** 전체 채널 개요 (멤버 수·매치 수·디스코드 연결 상태·소유 관리자). */
export async function listChannelsOverview(): Promise<ChannelOverview[]> {
  const supabase = await createClient();

  const [
    { data: channels },
    { data: admins },
    { data: links },
    { data: matches },
  ] = await Promise.all([
    supabase
      .from("channels")
      .select(
        "id, name, discord_guild_id, discord_channel_id, owner_admin_id, created_at",
      )
      .order("created_at", { ascending: true }),
    supabase.from("admins").select("id, username, display_name"),
    supabase.from("channel_members").select("channel_id"),
    supabase.from("matches").select("channel_id"),
  ]);

  const adminById = new Map(
    (admins ?? []).map((a) => [a.id as string, adminLabel(a)]),
  );
  const memberCount = countBy(links ?? [], "channel_id");
  const matchCount = countBy(matches ?? [], "channel_id");

  return (channels ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    discordGuildId: (c.discord_guild_id as string | null) ?? null,
    discordChannelId: (c.discord_channel_id as string | null) ?? null,
    ownerAdminId: (c.owner_admin_id as string | null) ?? null,
    ownerName: c.owner_admin_id
      ? (adminById.get(c.owner_admin_id as string) ?? null)
      : null,
    memberCount: memberCount.get(c.id as string) ?? 0,
    matchCount: matchCount.get(c.id as string) ?? 0,
  }));
}

/** 소유 관리자 지정 드롭다운용 관리자 목록. */
export async function listAdminOptions(): Promise<AdminOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admins")
    .select("id, username, display_name")
    .order("created_at", { ascending: true });
  return (data ?? []).map((a) => ({
    id: a.id as string,
    label: adminLabel(a),
  }));
}

/** 채널 상세 — 설정값 + 소속 멤버(디스코드 ID 포함). 없으면 null. */
export async function getChannelDetail(
  channelId: string,
): Promise<ChannelDetail | null> {
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select(
      "id, name, discord_guild_id, discord_channel_id, owner_admin_id, voice_channel_a_id, voice_channel_b_id, patch_channel_id",
    )
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return null;

  const { data: links } = await supabase
    .from("channel_members")
    .select("member_id, primary_role, secondary_role, joined_at")
    .eq("channel_id", channelId)
    .order("joined_at", { ascending: true });

  const memberIds = (links ?? []).map((l) => l.member_id as string);

  const [{ data: members }, { data: ratings }, ownerRow] = await Promise.all([
    memberIds.length
      ? supabase
          .from("members")
          .select("id, battle_tag, discord_name, discord_user_id")
          .in("id", memberIds)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase
          .from("member_role_ratings")
          .select("member_id, role, tier, division")
          .eq("channel_id", channelId)
      : Promise.resolve({ data: [] }),
    channel.owner_admin_id
      ? supabase
          .from("admins")
          .select("username, display_name")
          .eq("id", channel.owner_admin_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const memberById = new Map((members ?? []).map((m) => [m.id as string, m]));

  const memberRows: ChannelMemberRow[] = (links ?? []).map((link) => {
    const m = memberById.get(link.member_id as string);
    return {
      id: link.member_id as string,
      battleTag: (m?.battle_tag as string) ?? "(알 수 없음)",
      discordName: (m?.discord_name as string | null) ?? null,
      discordUserId: (m?.discord_user_id as string | null) ?? null,
      primaryRole: (link.primary_role as Role | null) ?? null,
      secondaryRole: (link.secondary_role as Role | null) ?? null,
      ratings: (ratings ?? [])
        .filter((r) => r.member_id === link.member_id)
        .map((r) => ({
          role: r.role as Role,
          tier: r.tier as string,
          division: r.division as number,
        })),
    };
  });

  return {
    id: channel.id as string,
    name: channel.name as string,
    discordGuildId: (channel.discord_guild_id as string | null) ?? null,
    discordChannelId: (channel.discord_channel_id as string | null) ?? null,
    ownerAdminId: (channel.owner_admin_id as string | null) ?? null,
    ownerName: ownerRow.data ? adminLabel(ownerRow.data) : null,
    voiceChannelAId: (channel.voice_channel_a_id as string | null) ?? null,
    voiceChannelBId: (channel.voice_channel_b_id as string | null) ?? null,
    patchChannelId: (channel.patch_channel_id as string | null) ?? null,
    members: memberRows,
  };
}

function countBy<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row[key] as string;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}
