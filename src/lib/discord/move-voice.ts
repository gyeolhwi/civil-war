// 디스코드 `/내전이동` — 확정된 매치의 A/B 팀을 각 음성채널로 이동시킨다.
//
// 흐름: guild_id → 내전 채널 → (코드로) 매치 → teams(A/B) → team_members → members.discord_user_id
//       → channels.voice_channel_a/b_id 로 PATCH 이동.
// 제약: 음성에 이미 접속한 멤버만 이동됨(디스코드) · discord_user_id 연동된 멤버만.
// 인터랙션 3초 제한 때문에 route 에서 deferred 응답 후 after() 로 이 함수를 돌린다.

import { resolveChannelId } from "@/lib/discord/register";
import { moveMemberToVoice } from "@/lib/discord/rest";
import { createAdminClient } from "@/lib/supabase/admin";

type Sb = ReturnType<typeof createAdminClient>;

/** KST 기준 "오늘 0시"의 UTC ISO — 프리셋 코드(일별 초기화)를 오늘 것으로 한정. */
function startOfKstTodayIso(): string {
  const KST = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST);
  const kstMidnight = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
  );
  return new Date(kstMidnight - KST).toISOString();
}

/**
 * 코드 → 매치 해석.
 * 코드 있으면: 오늘 이 채널 프리셋 #code → 그 세션의 최신 매치 (여러 판 돌려도 최신).
 * 코드 없으면: 이 채널의 최신 매치 (프리셋 미사용·수동 매치 포함).
 */
async function resolveMatchId(
  sb: Sb,
  channelId: string,
  code: number | null,
): Promise<{ matchId: string } | { error: string }> {
  if (code != null) {
    const { data: preset } = await sb
      .from("match_presets")
      .select("id")
      .eq("channel_id", channelId)
      .eq("code", code)
      .gte("created_at", startOfKstTodayIso())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!preset) {
      return {
        error: `오늘 #${code} 모집을 찾을 수 없어요. /내전 으로 올린 번호인지 확인해주세요.`,
      };
    }
    const { data: m } = await sb
      .from("matches")
      .select("id")
      .eq("preset_id", preset.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!m) {
      return {
        error: `#${code} 내전은 아직 팀이 확정되지 않았어요. 웹에서 '팀 확정' 후 다시 시도해주세요.`,
      };
    }
    return { matchId: m.id as string };
  }

  const { data: m } = await sb
    .from("matches")
    .select("id")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!m) {
    return { error: "확정된 내전이 없어요. 웹에서 팀을 먼저 확정해주세요." };
  }
  return { matchId: m.id as string };
}

/** `/내전이동` 본 작업. 결과 안내문(여러 줄)을 반환 → route 가 인터랙션 메시지로 편집. */
export async function runMoveVoice(
  guildId: string | undefined,
  code: number | null,
): Promise<string> {
  const sb = createAdminClient();
  const channelId = await resolveChannelId(sb, guildId);
  if (!channelId || !guildId) {
    return "이 서버는 아직 내전 채널과 연결되지 않았어요. 채널 관리자에게 문의해주세요.";
  }

  const { data: chan } = await sb
    .from("channels")
    .select("voice_channel_a_id, voice_channel_b_id")
    .eq("id", channelId)
    .maybeSingle();
  const voiceA = chan?.voice_channel_a_id as string | null | undefined;
  const voiceB = chan?.voice_channel_b_id as string | null | undefined;
  if (!voiceA || !voiceB) {
    return "A/B 음성채널이 설정되지 않았어요. 웹 관리자(/admin) 채널 설정에서 두 음성채널을 지정해주세요.";
  }

  const resolved = await resolveMatchId(sb, channelId, code);
  if ("error" in resolved) return resolved.error;

  const { data: teams } = await sb
    .from("teams")
    .select("id, side")
    .eq("match_id", resolved.matchId);
  if (!teams?.length) return "팀 정보를 찾을 수 없어요.";
  const sideByTeam = new Map(
    teams.map((t) => [t.id as string, t.side as "A" | "B"]),
  );

  const { data: tms } = await sb
    .from("team_members")
    .select("team_id, member_id")
    .in(
      "team_id",
      teams.map((t) => t.id),
    );
  if (!tms?.length) return "팀원 정보를 찾을 수 없어요.";

  const { data: members } = await sb
    .from("members")
    .select("id, discord_user_id, battle_tag")
    .in(
      "id",
      tms.map((t) => t.member_id),
    );
  const memberById = new Map((members ?? []).map((m) => [m.id as string, m]));

  // discord_user_id 연동된 멤버만 이동 (미연동은 조용히 제외 — 보고 안 함)
  const tasks: {
    side: "A" | "B";
    battleTag: string;
    discordId: string;
    target: string;
  }[] = [];
  for (const tm of tms) {
    const side = sideByTeam.get(tm.team_id as string);
    const m = memberById.get(tm.member_id as string);
    if (!side || !m) continue;
    const discordId = m.discord_user_id as string | null;
    if (!discordId) continue;
    tasks.push({
      side,
      battleTag: (m.battle_tag as string) ?? "(알 수 없음)",
      discordId,
      target: side === "A" ? voiceA : voiceB,
    });
  }

  const results = await Promise.all(
    tasks.map(async (t) => ({
      ...t,
      r: await moveMemberToVoice(guildId, t.discordId, t.target),
    })),
  );

  const movedA = results.filter((x) => x.r.ok && x.side === "A").length;
  const movedB = results.filter((x) => x.r.ok && x.side === "B").length;
  const notInVoice = results
    .filter((x) => !x.r.ok && x.r.reason === "not_in_voice")
    .map((x) => x.battleTag);
  const failed = results
    .filter((x) => !x.r.ok && x.r.reason !== "not_in_voice")
    .map((x) => x.battleTag);

  const lines = [`🔊 음성 이동 완료 — A팀 ${movedA}명 · B팀 ${movedB}명`];
  if (notInVoice.length) {
    lines.push(
      `· 음성 미접속 ${notInVoice.length}명(접속 후 다시 시도): ${notInVoice.join(", ")}`,
    );
  }
  if (failed.length) {
    lines.push(
      `· 이동 실패 ${failed.length}명(봇 권한·채널 확인): ${failed.join(", ")}`,
    );
  }
  return lines.join("\n");
}
