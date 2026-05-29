import { HERO_BY_CODE } from "@/constants/heroes";
import { MAP_BY_CODE } from "@/constants/maps";
import type { Role } from "@/domain/types";

/**
 * 팀 구성을 디스코드 붙여넣기용 텍스트로 변환 (workflow [7] F12b, SC-27).
 * 순수 함수 — 클립보드 복사는 호출부에서.
 */

const ROLE_EMOJI: Record<Role, string> = {
  tank: "🛡️",
  dps: "⚔️",
  support: "💉",
};

export interface ShareMember {
  battleTag: string;
  role: Role;
  heroCode?: string | null;
}

export interface ShareTeam {
  label: string;
  finalScore: number;
  members: ShareMember[];
}

export interface ShareInput {
  teamA: ShareTeam;
  teamB: ShareTeam;
  mapCode?: string | null;
  banA?: string | null;
  banB?: string | null;
}

function memberText(m: ShareMember): string {
  const hero = m.heroCode ? HERO_BY_CODE[m.heroCode]?.nameKo : null;
  return hero ? `${m.battleTag} (${hero})` : m.battleTag;
}

function teamBlock(emoji: string, team: ShareTeam): string {
  const byRole = (role: Role) =>
    team.members
      .filter((m) => m.role === role)
      .map(memberText)
      .join(" / ");

  return [
    `${emoji} ${team.label} (${team.finalScore.toLocaleString()})`,
    `${ROLE_EMOJI.tank} ${byRole("tank")}`,
    `${ROLE_EMOJI.dps} ${byRole("dps")}`,
    `${ROLE_EMOJI.support} ${byRole("support")}`,
  ].join("\n");
}

export function buildDiscordText(input: ShareInput): string {
  const blocks = [teamBlock("🔵", input.teamA), teamBlock("🔴", input.teamB)];

  const footer: string[] = [];
  if (input.mapCode) {
    footer.push(`🗺️ ${MAP_BY_CODE[input.mapCode]?.nameKo ?? input.mapCode}`);
  }
  const bans = [input.banA, input.banB]
    .filter((c): c is string => Boolean(c))
    .map((c) => HERO_BY_CODE[c]?.nameKo ?? c);
  if (bans.length) footer.push(`🚫 ${bans.join(" / ")}`);
  if (footer.length) blocks.push(footer.join("   "));

  return blocks.join("\n\n");
}
