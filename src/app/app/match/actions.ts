"use server";

import { revalidatePath } from "next/cache";
import type { BuildMode, Role } from "@/domain/types";
import { getMyChannel } from "@/lib/channel";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateMatchTeam {
  side: "A" | "B";
  totalScore: number;
  comboBonus: number;
  comboPenalty: number;
  finalScore: number;
  /** 팀장 모드일 때 팀장 member id (기본 모드는 생략) */
  captainId?: string | null;
  members: {
    memberId: string;
    assignedRole: Role;
    individualScore: number;
    /** 드래프트 픽 순서 1~8 (팀장·자동 모드는 생략) */
    pickOrder?: number | null;
  }[];
}

export interface CreateMatchInput {
  buildMode: BuildMode;
  teams: CreateMatchTeam[];
}

export interface SavedMember {
  teamMemberId: string;
  memberId: string;
  assignedRole: Role;
}

export interface SavedTeam {
  teamId: string;
  side: "A" | "B";
  finalScore: number;
  members: SavedMember[];
}

export interface SavedMatch {
  matchId: string;
  teams: SavedTeam[];
}

/**
 * 팀 확정 (workflow [7]): matches + teams(A/B) + team_members(10) 저장.
 * 결과·맵·밴은 이후 단계에서 채워지므로 여기선 NULL 상태로 생성 (SC-52).
 */
export async function createMatch(
  input: CreateMatchInput,
): Promise<ActionResult<SavedMatch>> {
  if (input.teams.length !== 2) {
    return { ok: false, error: "팀 구성이 올바르지 않습니다" };
  }
  const channel = await getMyChannel();
  if (!channel) return { ok: false, error: "배정된 채널이 없습니다" };

  const supabase = await createClient();

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .insert({ channel_id: channel.id, build_mode: input.buildMode })
    .select("id")
    .single();
  if (matchErr || !match) {
    return { ok: false, error: "매치 생성에 실패했습니다" };
  }

  const savedTeams: SavedTeam[] = [];
  for (const team of input.teams) {
    if (team.members.length !== 5) {
      return { ok: false, error: "각 팀은 5명이어야 합니다" };
    }
    const { data: teamRow, error: teamErr } = await supabase
      .from("teams")
      .insert({
        match_id: match.id,
        side: team.side,
        captain_id: team.captainId ?? null,
        total_score: team.totalScore,
        combo_bonus: team.comboBonus,
        combo_penalty: team.comboPenalty,
        final_score: team.finalScore,
      })
      .select("id")
      .single();
    if (teamErr || !teamRow) {
      return { ok: false, error: "팀 저장에 실패했습니다" };
    }

    const { data: tmRows, error: tmErr } = await supabase
      .from("team_members")
      .insert(
        team.members.map((m) => ({
          team_id: teamRow.id,
          member_id: m.memberId,
          assigned_role: m.assignedRole,
          individual_score: m.individualScore,
          pick_order: m.pickOrder ?? null,
        })),
      )
      .select("id, member_id, assigned_role");
    if (tmErr || !tmRows) {
      return { ok: false, error: "팀원 저장에 실패했습니다" };
    }

    savedTeams.push({
      teamId: teamRow.id,
      side: team.side,
      finalScore: team.finalScore,
      members: tmRows.map((r) => ({
        teamMemberId: r.id,
        memberId: r.member_id,
        assignedRole: r.assigned_role as Role,
      })),
    });
  }

  revalidatePath("/app/stats");
  return { ok: true, data: { matchId: match.id, teams: savedTeams } };
}

/** 맵·밴 저장 (workflow [8][9]). 밴은 생략 가능(NULL). */
export async function updateMapBan(
  matchId: string,
  mapCode: string | null,
  banA: string | null,
  banB: string | null,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("matches")
    .update({ map_code: mapCode, banned_hero_a: banA, banned_hero_b: banB })
    .eq("id", matchId);
  if (error) return { ok: false, error: "맵·밴 저장에 실패했습니다" };
  return { ok: true, data: null };
}

export interface SaveResultInput {
  winnerSide: "A" | "B" | null;
  scoreA: number;
  scoreB: number;
  memo: string | null;
  /** teamMemberId → 사용 영웅 코드 배열 (선택 순서 보존, 미입력은 빈 배열/생략) */
  heroes: Record<string, string[]>;
}

/**
 * 결과 입력 (workflow [11], SC-26): matches + teams.is_winner + team_members.heroes_used.
 * supabase-js는 트랜잭션 미지원이라 순차 처리 (v1 허용).
 */
export async function saveResult(
  matchId: string,
  input: SaveResultInput,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error: matchErr } = await supabase
    .from("matches")
    .update({
      winner_side: input.winnerSide,
      score_a: input.scoreA,
      score_b: input.scoreB,
      memo: input.memo,
    })
    .eq("id", matchId);
  if (matchErr) return { ok: false, error: "결과 저장에 실패했습니다" };

  // teams.is_winner: 승팀 true, 나머지 false (무승부는 양 팀 false, SC-53)
  const { data: teams } = await supabase
    .from("teams")
    .select("id, side")
    .eq("match_id", matchId);
  for (const t of teams ?? []) {
    await supabase
      .from("teams")
      .update({ is_winner: input.winnerSide === t.side })
      .eq("id", t.id);
  }

  // team_members.heroes_used (빈 배열도 반영 — 수정 시 영웅 제거 가능)
  for (const [teamMemberId, heroCodes] of Object.entries(input.heroes)) {
    await supabase
      .from("team_members")
      .update({ heroes_used: heroCodes.filter(Boolean) })
      .eq("id", teamMemberId);
  }

  revalidatePath("/app/stats");
  return { ok: true, data: null };
}
