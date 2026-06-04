import { HeroImage, ModeIcon, RoleIcon } from "@/components/ui/game-image";
import { HERO_BY_CODE } from "@/constants/heroes";
import { MAP_BY_CODE } from "@/constants/maps";
import type { PersonalMatch, PersonalStats } from "@/lib/personal-stats";

const heroName = (code: string | null) =>
  code ? (HERO_BY_CODE[code]?.nameKo ?? code) : null;

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
});

const RESULT_META: Record<
  PersonalMatch["result"],
  { label: string; cls: string }
> = {
  win: { label: "승", cls: "bg-emerald-500/15 text-emerald-400" },
  loss: { label: "패", cls: "bg-rose-500/15 text-rose-400" },
  draw: { label: "무", cls: "bg-surface-3 text-ink-muted" },
  pending: { label: "미입력", cls: "bg-surface-3 text-ink-subtle" },
};

/**
 * 한 멤버의 개인전적 표시 (집계 + 참여 매치 리스트).
 * `/app/stats` 개인 탭과 공개 검색(/record)이 공유한다.
 */
export function PersonalRecordView({ stats }: { stats: PersonalStats }) {
  if (stats.games === 0 && stats.matches.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-ink-subtle">
        참여한 매치 기록이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 지표 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="판수" value={`${stats.games}`} />
        <Stat
          label="전적"
          value={`${stats.wins}승 ${stats.losses}패 ${stats.draws}무`}
        />
        <Stat
          label="승률"
          value={stats.winRate === null ? "—" : `${stats.winRate}%`}
        />
        <HeroStat label="주 영웅" code={stats.mainHero} />
        <HeroStat label="최근 영웅" code={stats.recentHero} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ListBlock
          title="사용 영웅"
          items={stats.topHeroes.map(([code, n]) => ({
            label: heroName(code) ?? code,
            count: n,
          }))}
          empty="기록된 영웅이 없습니다 (미기록)"
        />
        <ListBlock
          title="자주 같은 팀"
          items={stats.topMates.map((mt) => ({
            label: mt.battleTag,
            count: mt.count,
          }))}
          empty="데이터가 부족합니다"
        />
      </div>

      {/* 참여 매치 리스트 */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          참여 매치 ({stats.matches.length})
        </p>
        <ul className="flex flex-col gap-1.5">
          {stats.matches.map((m) => (
            <MatchRow key={m.matchId} match={m} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: PersonalMatch }) {
  const meta = RESULT_META[match.result];
  const map = match.mapCode ? MAP_BY_CODE[match.mapCode] : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-surface-1 px-3 py-2 text-sm">
      <span
        className={`flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${meta.cls}`}
      >
        {meta.label}
      </span>
      <span className="text-ink-subtle">
        {dateFmt.format(new Date(match.playedAt))}
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
        <span className="tabular-nums text-ink-subtle">
          {match.scoreA ?? 0} : {match.scoreB ?? 0}
        </span>
      )}
      {match.heroesUsed.length > 0 && (
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-ink-subtle">
          {match.heroesUsed.map((code) => (
            <span key={code} className="flex items-center gap-1">
              <HeroImage code={code} size={18} />
              {heroName(code)}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <p className="text-xs text-ink-subtle">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function HeroStat({ label, code }: { label: string; code: string | null }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <p className="text-xs text-ink-subtle">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-medium">
        {code ? (
          <>
            <HeroImage code={code} size={20} />
            {heroName(code)}
          </>
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}

function ListBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: { label: string; count: number }[];
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-ink-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li
              key={it.label}
              className="flex justify-between gap-2 text-sm text-ink-muted"
            >
              <span>{it.label}</span>
              <span className="tabular-nums text-ink-subtle">{it.count}회</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
