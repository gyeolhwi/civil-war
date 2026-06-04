import type { Role } from "@/domain/types";
import type { MatchTeamView, MatchView } from "./matches";

export type ResultKind = "win" | "loss" | "draw" | "pending";

/** 개인전적의 한 매치 (본인 관점) */
export interface PersonalMatch {
  matchId: string;
  playedAt: string;
  mapCode: string | null;
  side: "A" | "B";
  assignedRole: Role;
  /** 본인이 사용한 영웅 (순서 보존) */
  heroesUsed: string[];
  result: ResultKind;
  scoreA: number | null;
  scoreB: number | null;
  /** 상세(아코디언)용 — 양 팀 전체 라인업·밴·메모 */
  teams: MatchTeamView[];
  bannedHeroA: string | null;
  bannedHeroB: string | null;
  memo: string | null;
}

/** 영웅별 집계 (모스트 영웅) */
export interface HeroStat {
  code: string;
  games: number;
  wins: number;
}

/** 같이 한 멤버 집계 (듀오) */
export interface MateStat {
  memberId: string;
  battleTag: string;
  games: number;
  wins: number;
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
  /** 최근 전적 흐름 (최신순, 확정 판만, 최대 12) */
  recentForm: { matchId: string; result: Exclude<ResultKind, "pending"> }[];
  /** 사용 영웅 집계 (판수 desc, 상위 8) */
  topHeroes: HeroStat[];
  /** 자주 같은 팀 (판수 desc, 상위 6) */
  topMates: MateStat[];
  /** 참여 매치 (최신순) */
  matches: PersonalMatch[];
}

const RECENT_FORM_MAX = 12;

/**
 * 한 멤버의 개인전적을 즉석 집계 (requirements §10).
 * `matches`는 played_at 내림차순(최신 먼저)으로 들어온다고 가정한다.
 * `/app/stats`와 공개 검색(/record)이 같은 로직을 공유해 정합성을 보장한다.
 */
export function computePersonalStats(
  matches: MatchView[],
  memberId: string,
): PersonalStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  const heroStats = new Map<string, HeroStat>();
  const mates = new Map<string, MateStat>();
  const personalMatches: PersonalMatch[] = [];
  const recentForm: PersonalStats["recentForm"] = [];
  let recentHero: string | null = null;

  for (const m of matches) {
    const team = m.teams.find((t) =>
      t.members.some((mem) => mem.memberId === memberId),
    );
    if (!team) continue;
    const self = team.members.find((mem) => mem.memberId === memberId);
    if (!self) continue;

    const decided = m.winnerSide !== null || m.scoreA !== null;
    const result: ResultKind = !decided
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
      teams: m.teams,
      bannedHeroA: m.bannedHeroA,
      bannedHeroB: m.bannedHeroB,
      memo: m.memo,
    });

    // 최근 영웅: 가장 최근(=처음 만나는) 판에서 영웅을 기록한 멤버
    if (recentHero === null && self.heroesUsed.length > 0) {
      recentHero = self.heroesUsed[self.heroesUsed.length - 1];
    }

    if (!decided || result === "pending") continue;

    if (recentForm.length < RECENT_FORM_MAX) {
      recentForm.push({ matchId: m.id, result });
    }
    if (result === "win") wins++;
    else if (result === "loss") losses++;
    else draws++;

    const won = result === "win";
    for (const code of self.heroesUsed) {
      const hs = heroStats.get(code) ?? { code, games: 0, wins: 0 };
      hs.games++;
      if (won) hs.wins++;
      heroStats.set(code, hs);
    }
    for (const mate of team.members) {
      if (mate.memberId === memberId) continue;
      const ms = mates.get(mate.memberId) ?? {
        memberId: mate.memberId,
        battleTag: mate.battleTag,
        games: 0,
        wins: 0,
      };
      ms.games++;
      if (won) ms.wins++;
      mates.set(mate.memberId, ms);
    }
  }

  const decidedGames = wins + losses;
  const topHeroes = [...heroStats.values()].sort((a, b) => b.games - a.games);

  return {
    games: wins + losses + draws,
    wins,
    losses,
    draws,
    winRate: decidedGames ? Math.round((wins / decidedGames) * 100) : null,
    mainHero: topHeroes[0]?.code ?? null,
    recentHero,
    recentForm,
    topHeroes: topHeroes.slice(0, 8),
    topMates: [...mates.values()].sort((a, b) => b.games - a.games).slice(0, 6),
    matches: personalMatches,
  };
}
