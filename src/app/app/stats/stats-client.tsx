"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HeroImage, ModeIcon, RoleIcon } from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HERO_BY_CODE,
  HEROES_BY_ROLE,
  ROLE_LABEL_KO,
} from "@/constants/heroes";
import { MAP_BY_CODE } from "@/constants/maps";
import type { MatchTeamView, MatchView } from "@/lib/matches";
import { cn } from "@/lib/utils";
import { saveResult } from "../match/actions";
import { deleteMatch } from "./actions";

const selectClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const BUILD_MODE_LABEL: Record<string, string> = {
  basic: "자동 밸런스",
  captain_top: "팀장(최고티어)",
  captain_tank: "팀장(탱커)",
  captain_fun: "팀장(예능)",
  captain_manual: "팀장(직접)",
};

const heroName = (code: string | null) =>
  code ? (HERO_BY_CODE[code]?.nameKo ?? code) : null;

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});
const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function StatsClient({ matches }: { matches: MatchView[] }) {
  if (matches.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-ink-subtle">
        아직 기록된 매치가 없습니다.{" "}
        <a href="/app/match/new" className="underline hover:text-foreground">
          내전 시작
        </a>
        에서 첫 판을 진행하세요.
      </p>
    );
  }

  return (
    <Tabs defaultValue="channel">
      <TabsList>
        <TabsTrigger value="channel">채널 전적</TabsTrigger>
        <TabsTrigger value="personal">개인 전적</TabsTrigger>
      </TabsList>
      <TabsContent value="channel" className="pt-2">
        <ChannelTab matches={matches} />
      </TabsContent>
      <TabsContent value="personal" className="pt-2">
        <PersonalTab matches={matches} />
      </TabsContent>
    </Tabs>
  );
}

// ── 채널 전적 (SC-41) ───────────────────────────────────
function ChannelTab({ matches }: { matches: MatchView[] }) {
  const sessions = useMemo(() => {
    const groups: { key: string; label: string; matches: MatchView[] }[] = [];
    for (const m of matches) {
      const key = dateKey(m.playedAt);
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: dateFmt.format(new Date(m.playedAt)), matches: [] };
        groups.push(g);
      }
      g.matches.push(m);
    }
    return groups;
  }, [matches]);

  return (
    <div className="flex flex-col gap-6">
      {sessions.map((s) => {
        const aWin = s.matches.filter((m) => m.winnerSide === "A").length;
        const bWin = s.matches.filter((m) => m.winnerSide === "B").length;
        const pending = s.matches.filter(
          (m) => m.winnerSide === null && m.scoreA === null,
        ).length;
        return (
          <section key={s.key} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ink-muted">
              {s.label} · {s.matches.length}판 · A승 {aWin} B승 {bWin}
              {pending > 0 && ` · 미입력 ${pending}`}
            </h2>
            <div className="flex flex-col gap-2">
              {s.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MatchCard({ match }: { match: MatchView }) {
  const resultPending = match.winnerSide === null && match.scoreA === null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-1 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-subtle">
            {timeFmt.format(new Date(match.playedAt))}
          </span>
          <Badge variant="outline">
            {BUILD_MODE_LABEL[match.buildMode] ?? match.buildMode}
          </Badge>
          {match.mapCode && (
            <span className="flex items-center gap-1 text-ink-subtle">
              {MAP_BY_CODE[match.mapCode] && (
                <ModeIcon mode={MAP_BY_CODE[match.mapCode].mode} size={14} />
              )}
              {MAP_BY_CODE[match.mapCode]?.nameKo ?? match.mapCode}
            </span>
          )}
          {resultPending ? (
            <Badge variant="secondary">결과 미입력</Badge>
          ) : (
            <span className="font-medium tabular-nums">
              {match.winnerSide === null
                ? "무승부"
                : `${match.winnerSide}팀 승`}{" "}
              ({match.scoreA ?? 0} : {match.scoreB ?? 0})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <EditMatchDialog match={match} />
          <DeleteMatchButton match={match} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {match.teams.map((t) => (
          <TeamColumn key={t.side} team={t} winnerSide={match.winnerSide} />
        ))}
      </div>

      {(match.bannedHeroA || match.bannedHeroB) && (
        <p className="text-xs text-ink-subtle">
          🚫{" "}
          {[match.bannedHeroA, match.bannedHeroB]
            .filter(Boolean)
            .map((c) => heroName(c))
            .join(" / ")}
        </p>
      )}
      {match.memo && (
        <p className="text-xs text-ink-subtle">메모: {match.memo}</p>
      )}
    </div>
  );
}

function TeamColumn({
  team,
  winnerSide,
}: {
  team: MatchTeamView;
  winnerSide: "A" | "B" | null;
}) {
  const isWinner = winnerSide === team.side;
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        team.side === "A" ? "border-team-a/30" : "border-team-b/30",
      )}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">
          {team.side}팀 {isWinner && "👑"}
        </span>
        <span className="tabular-nums text-xs text-ink-subtle">
          {team.finalScore.toLocaleString()}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {team.members.map((m) => (
          <li key={m.teamMemberId} className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <RoleIcon role={m.assignedRole} size={14} />
              {m.battleTag}
            </span>
            {m.heroUsed && (
              <span className="flex items-center gap-1 text-ink-subtle">
                <HeroImage code={m.heroUsed} size={18} />
                {heroName(m.heroUsed)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 개인 전적 (SC-40) ───────────────────────────────────
function PersonalTab({ matches }: { matches: MatchView[] }) {
  const members = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      for (const t of m.teams) {
        for (const mem of t.members) map.set(mem.memberId, mem.battleTag);
      }
    }
    return [...map.entries()]
      .map(([id, battleTag]) => ({ id, battleTag }))
      .sort((a, b) => a.battleTag.localeCompare(b.battleTag));
  }, [matches]);

  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return q
      ? members.filter((m) => m.battleTag.toLowerCase().includes(q))
      : members;
  }, [members, memberSearch]);

  const stats = useMemo(() => {
    let games = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    const heroes = new Map<string, number>();
    const mates = new Map<string, { battleTag: string; count: number }>();

    for (const m of matches) {
      const team = m.teams.find((t) =>
        t.members.some((mem) => mem.memberId === memberId),
      );
      if (!team) continue;
      const self = team.members.find((mem) => mem.memberId === memberId);
      const decided = m.winnerSide !== null || m.scoreA !== null;
      if (!decided) continue;
      games++;
      if (m.winnerSide === null) draws++;
      else if (m.winnerSide === team.side) wins++;
      else losses++;

      if (self?.heroUsed) {
        heroes.set(self.heroUsed, (heroes.get(self.heroUsed) ?? 0) + 1);
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

    const decidedGames = wins + losses;
    return {
      games,
      wins,
      losses,
      draws,
      winRate: decidedGames ? Math.round((wins / decidedGames) * 100) : null,
      topHeroes: [...heroes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topMates: [...mates.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }, [matches, memberId]);

  if (members.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">집계할 참가 기록이 없습니다.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="memberSearch">멤버</Label>
        <Input
          id="memberSearch"
          placeholder="배틀태그로 검색"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {filteredMembers.length === 0 ? (
            <span className="text-xs text-ink-subtle">검색 결과 없음</span>
          ) : (
            filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMemberId(m.id)}
              >
                <Badge
                  variant={memberId === m.id ? "default" : "outline"}
                  className="h-8 cursor-pointer px-3 text-sm"
                >
                  {m.battleTag}
                </Badge>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="판수" value={`${stats.games}`} />
        <Stat
          label="전적"
          value={`${stats.wins}승 ${stats.losses}패 ${stats.draws}무`}
        />
        <Stat
          label="승률"
          value={stats.winRate === null ? "—" : `${stats.winRate}%`}
        />
        <Stat
          label="대표 영웅"
          value={
            stats.topHeroes[0] ? (heroName(stats.topHeroes[0][0]) ?? "—") : "—"
          }
        />
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
    </div>
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

// ── 매치 수정 (SC-28) ───────────────────────────────────
function EditMatchDialog({ match }: { match: MatchView }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const allMembers = match.teams.flatMap((t) => t.members);

  const [winner, setWinner] = useState<"A" | "B" | "draw">(
    match.winnerSide ?? "draw",
  );
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? "");
  const [memo, setMemo] = useState(match.memo ?? "");
  // teamMemberId → 영웅 코드 ("" = 미입력)
  const [heroInputs, setHeroInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      allMembers.map((m) => [m.teamMemberId, m.heroUsed ?? ""]),
    ),
  );

  function submit() {
    if (scoreA.trim() === "" || scoreB.trim() === "") {
      toast.error("양 팀 스코어를 입력하세요 (필수)");
      return;
    }
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      toast.error("스코어는 0 이상의 정수로 입력하세요");
      return;
    }
    const heroes: Record<string, string> = {};
    for (const [tmId, code] of Object.entries(heroInputs)) {
      if (code) heroes[tmId] = code;
    }
    startTransition(async () => {
      const res = await saveResult(match.id, {
        winnerSide: winner === "draw" ? null : winner,
        scoreA: a,
        scoreB: b,
        memo: memo.trim() || null,
        heroes,
      });
      if (res.ok) {
        toast.success("매치를 수정했습니다");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        수정
      </Button>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>매치 수정</DialogTitle>
          <DialogDescription>
            승팀·스코어·사용 영웅·메모를 정정합니다. 팀 구성은 바뀌지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label>승팀</Label>
          <div className="flex gap-2">
            {(["A", "B", "draw"] as const).map((w) => (
              <Button
                key={w}
                type="button"
                variant={winner === w ? "default" : "secondary"}
                size="sm"
                onClick={() => setWinner(w)}
              >
                {w === "draw" ? "무승부" : `${w}팀 승`}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editScoreA">A팀 스코어</Label>
            <Input
              id="editScoreA"
              inputMode="numeric"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editScoreB">B팀 스코어</Label>
            <Input
              id="editScoreB"
              inputMode="numeric"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {match.teams.map((t) => (
            <div key={t.side} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t.side}팀</p>
              {t.members.map((m) => (
                <div key={m.teamMemberId} className="flex items-center gap-2">
                  <span className="flex w-24 shrink-0 items-center gap-1.5 text-sm">
                    <RoleIcon role={m.assignedRole} size={14} />
                    <span className="truncate">{m.battleTag}</span>
                  </span>
                  <select
                    className={cn(selectClass, "flex-1")}
                    value={heroInputs[m.teamMemberId] ?? ""}
                    onChange={(e) =>
                      setHeroInputs((prev) => ({
                        ...prev,
                        [m.teamMemberId]: e.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {ROLE_LABEL_KO[m.assignedRole]} 영웅 (선택)
                    </option>
                    {HEROES_BY_ROLE[m.assignedRole].map((h) => (
                      <option key={h.code} value={h.code}>
                        {h.nameKo}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="editMemo">메모 (선택)</Label>
          <textarea
            id="editMemo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 매치 삭제 (SC-29) ───────────────────────────────────
function DeleteMatchButton({ match }: { match: MatchView }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await deleteMatch(match.id);
      if (res.ok) {
        toast.success("매치를 삭제했습니다");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>매치 삭제</DialogTitle>
          <DialogDescription>
            이 매치를 삭제합니다. 팀·팀원 기록도 함께 제거되며 되돌릴 수
            없습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
