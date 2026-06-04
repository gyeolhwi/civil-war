"use server";

import { loadMatches } from "@/lib/matches";
import { loadMemberProfile, type MemberProfile } from "@/lib/member-profile";
import { computePersonalStats, type PersonalStats } from "@/lib/personal-stats";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MemberHit {
  memberId: string;
  battleTag: string;
  discordName: string | null;
  channels: { id: string; name: string }[];
}

/** PostgREST or() 필터를 깨거나 와일드카드를 남용하지 못하게 입력 정리 */
function sanitize(q: string): string {
  return q.replace(/[,()%*]/g, "").trim();
}

/**
 * 닉네임/배틀태그로 멤버 공개 검색 (로그인 불필요).
 * 매칭된 멤버와 그 멤버가 속한 채널 목록을 돌려준다.
 */
export async function searchMembers(query: string): Promise<MemberHit[]> {
  const q = sanitize(query);
  if (q.length < 2) return [];

  const supabase = createAdminClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, battle_tag, discord_name")
    .or(`battle_tag.ilike.%${q}%,discord_name.ilike.%${q}%`)
    .limit(10);

  if (!members || members.length === 0) return [];

  const memberIds = members.map((m) => m.id);

  const { data: cms } = await supabase
    .from("channel_members")
    .select("member_id, channels(id, name)")
    .in("member_id", memberIds);

  const channelsByMember = new Map<string, { id: string; name: string }[]>();
  for (const cm of cms ?? []) {
    // PostgREST 조인은 객체 또는 배열로 올 수 있어 모두 처리
    const ch = cm.channels as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const list = channelsByMember.get(cm.member_id) ?? [];
    for (const c of Array.isArray(ch) ? ch : ch ? [ch] : []) {
      if (!list.some((x) => x.id === c.id)) list.push(c);
    }
    channelsByMember.set(cm.member_id, list);
  }

  return members.map((m) => ({
    memberId: m.id,
    battleTag: m.battle_tag,
    discordName: m.discord_name ?? null,
    channels: channelsByMember.get(m.id) ?? [],
  }));
}

export interface RecordResult {
  profile: MemberProfile;
  stats: PersonalStats;
}

/**
 * 특정 멤버의 특정 채널 개인전적 + 프로필을 반환 (공개).
 * 멤버가 해당 채널 소속인지 확인 후, 그 채널 범위로만 조회한다.
 */
export async function getRecord(
  memberId: string,
  channelId: string,
): Promise<RecordResult | null> {
  const supabase = createAdminClient();

  const profile = await loadMemberProfile(channelId, memberId, supabase);
  if (!profile) return null; // 소속 아님 → 조회 거부

  const matches = await loadMatches(channelId, supabase);
  return { profile, stats: computePersonalStats(matches, memberId) };
}
