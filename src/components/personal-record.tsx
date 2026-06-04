import { MatchHistoryList } from "@/components/match-history";
import {
  HeroImage,
  ModeIcon,
  RoleIcon,
  TierImage,
} from "@/components/ui/game-image";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import { MAP_BY_CODE } from "@/constants/maps";
import { TIER_LABEL_KO } from "@/constants/tiers";
import type { Role } from "@/domain/types";
import type { MemberProfile } from "@/lib/member-profile";
import type { HeroStat, MateStat, PersonalStats } from "@/lib/personal-stats";
import { heroName, RESULT_META } from "@/lib/record-ui";
import { cn } from "@/lib/utils";

const ROLES_ORDERED: Role[] = ["tank", "dps", "support"];

const winRateOf = (wins: number, games: number) =>
  games ? Math.round((wins / games) * 100) : 0;

/**
 * 한 멤버의 개인전적 (op.gg 스타일).
 * `profile`을 주면 상단에 프로필 헤더(티어·포지션·선호)를 함께 보여준다.
 * `/app/stats` 개인 탭과 공개 검색(/record)이 공유한다.
 */
export function PersonalRecordView({
  stats,
  profile,
  memberId,
}: {
  stats: PersonalStats;
  profile?: MemberProfile | null;
  /** 전적 상세에서 본인 강조용 */
  memberId?: string;
}) {
  if (stats.games === 0 && stats.matches.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {profile && <ProfileHeader profile={profile} />}
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-ink-subtle">
          아직 기록된 매치가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {profile && <ProfileHeader profile={profile} />}

      <SummaryCard stats={stats} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="모스트 영웅">
          {stats.topHeroes.length === 0 ? (
            <Empty>기록된 영웅이 없습니다 (미기록)</Empty>
          ) : (
            <ul className="flex flex-col">
              {stats.topHeroes.map((h) => (
                <HeroRow key={h.code} hero={h} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="자주 같은 팀">
          {stats.topMates.length === 0 ? (
            <Empty>데이터가 부족합니다</Empty>
          ) : (
            <ul className="flex flex-col">
              {stats.topMates.map((m) => (
                <MateRow key={m.memberId} mate={m} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={`전적 ${stats.matches.length}`}>
        <MatchHistoryList matches={stats.matches} memberId={memberId} />
      </Panel>
    </div>
  );
}

// ── 프로필 헤더 ──────────────────────────────────────────
function ProfileHeader({ profile }: { profile: MemberProfile }) {
  const name = profile.battleTag.split("#")[0];
  const ratedRoles = ROLES_ORDERED.filter((r) => profile.ratings[r]);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-base font-semibold text-ink">
          {name.slice(0, 2)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-lg font-semibold text-foreground">
            {profile.battleTag}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
            {profile.discordName && <span>{profile.discordName}</span>}
            {profile.primaryRole && (
              <span className="flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-ink-muted">
                <RoleIcon role={profile.primaryRole} size={12} />주{" "}
                {ROLE_LABEL_KO[profile.primaryRole]}
              </span>
            )}
            {profile.secondaryRole && (
              <span className="flex items-center gap-1 text-ink-subtle">
                <RoleIcon role={profile.secondaryRole} size={12} />부{" "}
                {ROLE_LABEL_KO[profile.secondaryRole]}
              </span>
            )}
          </div>
        </div>
      </div>

      {ratedRoles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {ratedRoles.map((r) => {
            const rt = profile.ratings[r];
            if (!rt) return null;
            return (
              <div
                key={r}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-surface-2 px-2.5 py-2"
              >
                <TierImage tier={rt.tier} size={28} />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1 text-[11px] text-ink-subtle">
                    <RoleIcon role={r} size={11} />
                    {ROLE_LABEL_KO[r]}
                  </span>
                  <span className="truncate text-xs font-medium text-ink">
                    {TIER_LABEL_KO[rt.tier]} {rt.division}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {profile.heroCodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-subtle">선호</span>
          {profile.heroCodes.map((code) => (
            <span
              key={code}
              className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2 text-xs text-ink-muted"
            >
              <HeroImage code={code} size={18} />
              {heroName(code)}
            </span>
          ))}
        </div>
      )}

      {profile.mapCodes.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-subtle">
          <span>선호 맵</span>
          {profile.mapCodes.map((code) => (
            <span key={code} className="flex items-center gap-1 text-ink-muted">
              {MAP_BY_CODE[code] && (
                <ModeIcon mode={MAP_BY_CODE[code].mode} size={12} />
              )}
              {MAP_BY_CODE[code]?.nameKo ?? code}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// ── 요약 (승률·최근폼) ───────────────────────────────────
function SummaryCard({ stats }: { stats: PersonalStats }) {
  const decided = stats.wins + stats.losses;
  const winPct = stats.winRate ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border/60 bg-surface-1 p-4">
      <div className="flex items-center gap-4">
        <WinRateRing pct={winPct} hasData={stats.winRate !== null} />
        <div className="flex flex-col leading-tight">
          <span className="text-sm text-ink-subtle">{stats.games}판</span>
          <span className="text-base font-semibold text-foreground">
            <span className="text-sky-300">{stats.wins}승</span>{" "}
            <span className="text-rose-300">{stats.losses}패</span>
            {stats.draws > 0 && (
              <span className="text-ink-subtle"> {stats.draws}무</span>
            )}
          </span>
          {decided > 0 && (
            <span className="text-xs text-ink-subtle">
              {decided}판 기준 승률
            </span>
          )}
        </div>
      </div>

      {stats.recentForm.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-subtle">
            최근 {stats.recentForm.length}판
          </span>
          <div className="flex gap-1">
            {stats.recentForm.map((f) => (
              <span
                key={f.matchId}
                title={RESULT_META[f.result].label}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                  RESULT_META[f.result].chip,
                )}
              >
                {RESULT_META[f.result].label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WinRateRing({ pct, hasData }: { pct: number; hasData: boolean }) {
  // conic-gradient 도넛 (승=파랑, 패=빨강)
  const ring = hasData
    ? `conic-gradient(var(--color-sky-500, #0ea5e9) ${pct * 3.6}deg, var(--color-rose-500, #f43f5e) 0)`
    : "conic-gradient(var(--color-surface-3, #2a2c32) 360deg)";
  return (
    <div
      className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
      style={{ background: ring }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-1">
        <span className="text-sm font-bold text-foreground">
          {hasData ? `${pct}%` : "—"}
        </span>
      </div>
    </div>
  );
}

// ── 모스트 영웅 / 듀오 행 ────────────────────────────────
function HeroRow({ hero }: { hero: HeroStat }) {
  const pct = winRateOf(hero.wins, hero.games);
  const high = pct >= 50;
  return (
    <li className="flex items-center gap-3 border-b border-border/40 py-2 last:border-0">
      <HeroImage code={hero.code} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{heroName(hero.code)}</span>
          <span className="shrink-0 text-xs text-ink-subtle">
            {hero.games}판 ·{" "}
            <span className={high ? "text-sky-300" : "text-rose-300"}>
              {pct}%
            </span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn(
              "h-full rounded-full",
              high ? "bg-sky-500" : "bg-rose-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function MateRow({ mate }: { mate: MateStat }) {
  const pct = winRateOf(mate.wins, mate.games);
  const high = pct >= 50;
  return (
    <li className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
      <span className="truncate">{mate.battleTag}</span>
      <span className="shrink-0 text-xs text-ink-subtle">
        {mate.games}판 ·{" "}
        <span className={high ? "text-sky-300" : "text-rose-300"}>{pct}%</span>
      </span>
    </li>
  );
}

// ── 공통 ─────────────────────────────────────────────────
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-1 p-4">
      <h3 className="text-sm font-semibold text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-xs text-ink-subtle">{children}</p>;
}
