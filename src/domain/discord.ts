import type { Role } from "@/domain/types";

/**
 * 팀 구성을 디스코드 붙여넣기용 텍스트로 변환 (workflow [7] F12b, SC-27).
 * 순수 함수 — 클립보드 복사는 호출부에서.
 * 영웅·맵 이름 해석은 호출부가 주입 (마스터 데이터는 DB).
 */

const ROLE_EMOJI: Record<Role, string> = {
  tank: "🛡️",
  dps: "⚔️",
  support: "💉",
};

/** 코드 → 한글명 해석기 (없으면 코드 그대로 표시) */
export interface NameResolver {
  heroName: (code: string) => string | undefined;
  mapName: (code: string) => string | undefined;
}

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

function memberText(m: ShareMember, resolve: NameResolver): string {
  const hero = m.heroCode ? resolve.heroName(m.heroCode) : null;
  return hero ? `${m.battleTag} (${hero})` : m.battleTag;
}

function teamBlock(
  emoji: string,
  team: ShareTeam,
  resolve: NameResolver,
): string {
  const byRole = (role: Role) =>
    team.members
      .filter((m) => m.role === role)
      .map((m) => memberText(m, resolve))
      .join(" / ");

  return [
    `${emoji} ${team.label} (${team.finalScore.toLocaleString()})`,
    `${ROLE_EMOJI.tank} ${byRole("tank")}`,
    `${ROLE_EMOJI.dps} ${byRole("dps")}`,
    `${ROLE_EMOJI.support} ${byRole("support")}`,
  ].join("\n");
}

export function buildDiscordText(
  input: ShareInput,
  resolve: NameResolver,
): string {
  const blocks = [
    teamBlock("🔵", input.teamA, resolve),
    teamBlock("🔴", input.teamB, resolve),
  ];

  const footer: string[] = [];
  if (input.mapCode) {
    footer.push(`🗺️ ${resolve.mapName(input.mapCode) ?? input.mapCode}`);
  }
  const bans = [input.banA, input.banB]
    .filter((c): c is string => Boolean(c))
    .map((c) => resolve.heroName(c) ?? c);
  if (bans.length) footer.push(`🚫 ${bans.join(" / ")}`);
  if (footer.length) blocks.push(footer.join("   "));

  return blocks.join("\n\n");
}
