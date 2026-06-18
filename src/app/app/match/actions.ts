"use server";

import { revalidatePath } from "next/cache";
import type { BuildMode, Role } from "@/domain/types";
import { getMyChannel } from "@/lib/channel";
import { getReactionUsers } from "@/lib/discord/rest";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface PresetMembersResult {
  /** 이 채널 멤버로 매핑된, ✅ 반응한 멤버 id 목록 */
  memberIds: string[];
  /** ✅ 반응자 수 (봇 제외) */
  reactedCount: number;
  /** 매핑되지 못한(미등록·미연결) 반응자의 디스코드 닉네임 — 관리자가 직접 선택하도록 안내 */
  unmatchedNames: string[];
}

/**
 * 프리셋(모집 메시지)의 ✅ 반응자를 디스코드 ID로 채널 멤버에 매핑해 반환.
 * 웹 "내전 시작 → 프리셋 불러오기"가 이 결과로 참가자를 자동 선택한다.
 */
export async function loadPresetMembers(
  presetId: string,
): Promise<ActionResult<PresetMembersResult>> {
  const channel = await getMyChannel();
  if (!channel) return { ok: false, error: "배정된 채널이 없습니다" };

  const supabase = await createClient();

  // RLS(owns_channel)로 본인 채널 프리셋만 조회된다.
  const { data: preset } = await supabase
    .from("match_presets")
    .select("discord_channel_id, discord_message_id, channel_id")
    .eq("id", presetId)
    .eq("channel_id", channel.id)
    .maybeSingle();
  if (!preset) return { ok: false, error: "프리셋을 찾을 수 없습니다" };

  let reactors: {
    id: string;
    username?: string;
    global_name?: string | null;
    bot?: boolean;
  }[];
  try {
    reactors = await getReactionUsers(
      preset.discord_channel_id as string,
      preset.discord_message_id as string,
      "✅",
    );
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "디스코드 반응을 불러오지 못했습니다",
    };
  }
  // 봇이 시드로 단 ✅ 는 제외. 1차: 디스코드 user 객체의 bot 플래그(가장 확실,
  // env 불필요). 2차: application id 일치(런타임에 env 있으면 보강).
  const botId = process.env.DISCORD_APPLICATION_ID;
  const realReactors = reactors.filter((r) => !r.bot && r.id !== botId);
  if (realReactors.length === 0) {
    return {
      ok: true,
      data: { memberIds: [], reactedCount: 0, unmatchedNames: [] },
    };
  }
  const reactorIds = realReactors.map((r) => r.id);

  // 디스코드 ID → 멤버(연결됨), 그중 이 채널 소속만 추린다.
  const [{ data: members }, { data: links }] = await Promise.all([
    supabase
      .from("members")
      .select("id, discord_user_id")
      .in("discord_user_id", reactorIds),
    supabase
      .from("channel_members")
      .select("member_id")
      .eq("channel_id", channel.id),
  ]);

  const channelMemberIds = new Set((links ?? []).map((l) => l.member_id));
  const matched = (members ?? []).filter((m) =>
    channelMemberIds.has(m.id as string),
  );
  const memberIds = matched.map((m) => m.id as string);

  // 선택된 멤버의 디스코드 ID → 미매칭(미등록·타채널·미연결) 반응자 닉네임 추출
  const matchedDiscordIds = new Set(matched.map((m) => m.discord_user_id));
  const unmatchedNames = realReactors
    .filter((r) => !matchedDiscordIds.has(r.id))
    .map((r) => r.global_name?.trim() || r.username?.trim() || "(알 수 없음)");

  return {
    ok: true,
    data: {
      memberIds,
      reactedCount: realReactors.length,
      unmatchedNames,
    },
  };
}

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
