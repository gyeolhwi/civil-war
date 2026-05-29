import { ROLE_ORDER } from "@/constants/heroes";
import type { BuildMode, Role } from "@/domain/types";
import { createClient } from "@/lib/supabase/server";

export interface MatchMemberView {
  teamMemberId: string;
  memberId: string;
  battleTag: string;
  assignedRole: Role;
  heroUsed: string | null;
}

export interface MatchTeamView {
  side: "A" | "B";
  finalScore: number;
  isWinner: boolean | null;
  members: MatchMemberView[];
}

export interface MatchView {
  id: string;
  playedAt: string;
  buildMode: BuildMode;
  mapCode: string | null;
  bannedHeroA: string | null;
  bannedHeroB: string | null;
  winnerSide: "A" | "B" | null;
  scoreA: number | null;
  scoreB: number | null;
  memo: string | null;
  teams: MatchTeamView[];
}

/**
 * 채널의 모든 매치를 팀·팀원까지 펼쳐 로드 (F12 통계, F12c 수정·삭제용).
 * 통계는 저장하지 않고 조회 시 즉석 집계 (requirements §10).
 */
export async function loadMatches(channelId: string): Promise<MatchView[]> {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, played_at, build_mode, map_code, banned_hero_a, banned_hero_b, winner_side, score_a, score_b, memo",
    )
    .eq("channel_id", channelId)
    .order("played_at", { ascending: false });

  if (!matches || matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, match_id, side, final_score, is_winner")
    .in("match_id", matchIds);

  const teamIds = (teams ?? []).map((t) => t.id);

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, team_id, member_id, assigned_role, hero_used")
    .in(
      "team_id",
      teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const memberIds = [...new Set((teamMembers ?? []).map((tm) => tm.member_id))];

  const { data: members } = await supabase
    .from("members")
    .select("id, battle_tag")
    .in(
      "id",
      memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const battleTagById = new Map(
    (members ?? []).map((m) => [m.id, m.battle_tag]),
  );

  const membersByTeam = new Map<string, MatchMemberView[]>();
  for (const tm of teamMembers ?? []) {
    const list = membersByTeam.get(tm.team_id) ?? [];
    list.push({
      teamMemberId: tm.id,
      memberId: tm.member_id,
      battleTag: battleTagById.get(tm.member_id) ?? "(알 수 없음)",
      assignedRole: tm.assigned_role as Role,
      heroUsed: tm.hero_used ?? null,
    });
    membersByTeam.set(tm.team_id, list);
  }

  const teamsByMatch = new Map<string, MatchTeamView[]>();
  for (const t of teams ?? []) {
    const list = teamsByMatch.get(t.match_id) ?? [];
    list.push({
      side: t.side as "A" | "B",
      finalScore: t.final_score,
      isWinner: t.is_winner,
      members: (membersByTeam.get(t.id) ?? []).sort(
        (a, b) => ROLE_ORDER[a.assignedRole] - ROLE_ORDER[b.assignedRole],
      ),
    });
    teamsByMatch.set(t.match_id, list);
  }

  return matches.map((m) => ({
    id: m.id,
    playedAt: m.played_at,
    buildMode: m.build_mode as BuildMode,
    mapCode: m.map_code ?? null,
    bannedHeroA: m.banned_hero_a ?? null,
    bannedHeroB: m.banned_hero_b ?? null,
    winnerSide: (m.winner_side as "A" | "B" | null) ?? null,
    scoreA: m.score_a ?? null,
    scoreB: m.score_b ?? null,
    memo: m.memo ?? null,
    teams: (teamsByMatch.get(m.id) ?? []).sort((a, b) =>
      a.side.localeCompare(b.side),
    ),
  }));
}
