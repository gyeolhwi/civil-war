import type { Role } from "@/domain/types";
import type { MatchView } from "./matches";

/** 개인전적의 한 매치 (본인 관점) */
export interface PersonalMatch {
  matchId: string;
  playedAt: string;
  mapCode: string | null;
  side: "A" | "B";
  assignedRole: Role;
  /** 본인이 사용한 영웅 (순서 보존) */
  heroesUsed: string[];
  result: "win" | "loss" | "draw" | "pending";
  scoreA: number | null;
  scoreB: number | null;
}

export interface PersonalStats {
  /** 결과가 확정된 판 수 (승+패+무) */
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** 승/패만 기준 승률 (무승부 제외). 데이터 없으면 null */
  winRate: number | null;
  /** 주 영웅 = 가장 많이 사용 (동률은 최근 우선) */
  mainHero: string | null;
  /** 최근 영웅 = 가장 최근 판에서 마지막으로 사용한 영웅 */
  recentHero: string | null;
  /** 사용 영웅 빈도 상위 (code, 횟수) */
  topHeroes: [string, number][];
  /** 자주 같은 팀 상위 */
  topMates: { memberId: string; battleTag: string; count: number }[];
  /** 참여 매치 (최신순) */
  matches: PersonalMatch[];
}

/**
 * 한 멤버의 개인전적을 즉석 집계 (requirements §10).
 * `matches`는 played_at 내림차순(최신 먼저)으로 들어온다고 가정한다.
 * `/app/stats`와 공개 검색이 같은 로직을 공유해 정합성을 보장한다.
 */
export function computePersonalStats(
  matches: MatchView[],
  memberId: string,
): PersonalStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const heroCount = new Map<string, number>();
  const mates = new Map<string, { battleTag: string; count: number }>();
  const personalMatches: PersonalMatch[] = [];
  let recentHero: string | null = null;

  for (const m of matches) {
    const team = m.teams.find((t) =>
      t.members.some((mem) => mem.memberId === memberId),
    );
    if (!team) continue;
    const self = team.members.find((mem) => mem.memberId === memberId);
    if (!self) continue;

    const decided = m.winnerSide !== null || m.scoreA !== null;
    const result: PersonalMatch["result"] = !decided
      ? "pending"
      : m.winnerSide === null
        ? "draw"
        : m.winnerSide === team.side
          ? "win"
          : "loss";

    personalMatches.push({
      matchId: m.id,
      playedAt: m.playedAt,
      mapCode: m.mapCode,
      side: team.side,
      assignedRole: self.assignedRole,
      heroesUsed: self.heroesUsed,
      result,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
    });

    // 최근 영웅: 가장 최근(=처음 만나는) 판에서 영웅을 기록한 멤버
    if (recentHero === null && self.heroesUsed.length > 0) {
      recentHero = self.heroesUsed[self.heroesUsed.length - 1];
    }

    if (decided) {
      if (result === "win") wins++;
      else if (result === "loss") losses++;
      else draws++;

      for (const code of self.heroesUsed) {
        heroCount.set(code, (heroCount.get(code) ?? 0) + 1);
      }
      for (const mate of team.members) {
        if (mate.memberId === memberId) continue;
        const prev = mates.get(mate.memberId);
        mates.set(mate.memberId, {
          battleTag: mate.battleTag,
          count: (prev?.count ?? 0) + 1,
        });
      }
    }
  }

  const decidedGames = wins + losses;
  const topHeroes = [...heroCount.entries()].sort((a, b) => b[1] - a[1]);

  return {
    games: wins + losses + draws,
    wins,
    losses,
    draws,
    winRate: decidedGames ? Math.round((wins / decidedGames) * 100) : null,
    mainHero: topHeroes[0]?.[0] ?? null,
    recentHero,
    topHeroes: topHeroes.slice(0, 5),
    topMates: [...mates.entries()]
      .map(([memberId, v]) => ({ memberId, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    matches: personalMatches,
  };
}
