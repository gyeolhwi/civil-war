"use client";

import { useEffect, useRef, useState } from "react";
import { HeroImage, ModeIcon, RoleIcon } from "@/components/ui/game-image";
import { MAP_BY_CODE } from "@/constants/maps";
import type { MatchTeamView } from "@/lib/matches";
import type { PersonalMatch } from "@/lib/personal-stats";
import { RESULT_META, recordDateFmt } from "@/lib/record-ui";
import { cn } from "@/lib/utils";

const PAGE = 10;

/**
 * 개인 전적 리스트 — 아코디언(클릭 시 양 팀 상세) + 무한 스크롤(10개씩).
 * 데이터는 이미 메모리에 있어 서버 왕복 없이 점진 렌더한다.
 */
export function MatchHistoryList({
  matches,
  memberId,
}: {
  matches: PersonalMatch[];
  memberId?: string;
}) {
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const hasMore = visible < matches.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => Math.min(v + PAGE, matches.length));
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, matches.length]);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {matches.slice(0, visible).map((m) => (
          <MatchItem key={m.matchId} match={m} memberId={memberId} />
        ))}
      </ul>

      {hasMore && (
        <div ref={sentinel} className="flex justify-center py-2">
          <button
            type="button"
            onClick={() =>
              setVisible((v) => Math.min(v + PAGE, matches.length))
            }
            className="text-xs text-ink-subtle transition-colors hover:text-foreground"
          >
            더 보기 ({matches.length - visible})
          </button>
        </div>
      )}
    </div>
  );
}

function MatchItem({
  match,
  memberId,
}: {
  match: PersonalMatch;
  memberId?: string;
}) {
  const meta = RESULT_META[match.result];
  const map = match.mapCode ? MAP_BY_CODE[match.mapCode] : null;
  const bans = [match.bannedHeroA, match.bannedHeroB].filter(
    Boolean,
  ) as string[];

  return (
    <li className="flex items-stretch gap-3 overflow-hidden rounded-lg border border-border/60 bg-surface-1">
      <span className={cn("w-1 shrink-0", meta.band)} />
      <div className="flex flex-1 flex-col gap-2 py-2.5 pr-3">
        {/* 헤더 — 결과·날짜·역할·맵·스코어·본인 영웅 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span
            className={cn(
              "flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
              meta.chip,
            )}
          >
            {meta.label}
          </span>
          <span className="text-ink-subtle">
            {recordDateFmt.format(new Date(match.playedAt))}
          </span>
          <span className="flex items-center gap-1 text-ink-muted">
            <RoleIcon role={match.assignedRole} size={14} />
            {match.side}팀
          </span>
          {map && (
            <span className="flex items-center gap-1 text-ink-subtle">
              <ModeIcon mode={map.mode} size={14} />
              {map.nameKo}
            </span>
          )}
          {match.result !== "pending" && (
            <span className={cn("tabular-nums font-medium", meta.text)}>
              {match.scoreA ?? 0} : {match.scoreB ?? 0}
            </span>
          )}
          {bans.length > 0 && (
            <span className="flex flex-wrap items-center gap-1 text-xs text-ink-subtle">
              🚫
              {bans.map((code) => (
                <HeroImage key={code} code={code} size={16} />
              ))}
            </span>
          )}
        </div>

        {/* 양 팀 전체 라인업 (항상 펼침) */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {match.teams.map((t) => (
            <TeamDetail key={t.side} team={t} memberId={memberId} />
          ))}
        </div>

        {match.memo && (
          <p className="text-xs text-ink-subtle">메모: {match.memo}</p>
        )}
      </div>
    </li>
  );
}

function TeamDetail({
  team,
  memberId,
}: {
  team: MatchTeamView;
  memberId?: string;
}) {
  const isWinner = team.isWinner === true;
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        team.side === "A" ? "border-team-a/30" : "border-team-b/30",
        isWinner &&
          (team.side === "A"
            ? "border-team-a/60 bg-team-a/5"
            : "border-team-b/60 bg-team-b/5"),
      )}
    >
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium">
          {team.side}팀 {isWinner && "👑"}
        </span>
        <span className="tabular-nums text-ink-subtle">
          {team.finalScore.toLocaleString()}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {team.members.map((mem) => {
          const isSelf = mem.memberId === memberId;
          return (
            <li
              key={mem.teamMemberId}
              className={cn(
                "flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs",
                isSelf && "bg-primary/10",
              )}
            >
              <span className="flex items-center gap-1 truncate">
                <RoleIcon role={mem.assignedRole} size={12} />
                <span
                  className={cn("truncate", isSelf && "font-semibold text-ink")}
                >
                  {mem.battleTag}
                </span>
                {isSelf && <span className="text-[10px] text-primary">나</span>}
              </span>
              {mem.heroesUsed.length > 0 && (
                <span className="flex shrink-0 items-center gap-0.5">
                  {mem.heroesUsed.map((code) => (
                    <HeroImage key={code} code={code} size={16} />
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
