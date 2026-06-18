"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { HeroMultiSelect } from "@/components/hero-multi-select";
import { useRefData } from "@/components/ref-data-provider";
import { RulesModal } from "@/components/rules-modal";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HeroImage,
  MapImage,
  ModeIcon,
  preloadGameImages,
  RoleIcon,
} from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SortSelect } from "@/components/ui/sort-select";
import { ROLE_LABEL_KO, ROLE_ORDER } from "@/constants/heroes";
import { MODE_LABEL_KO } from "@/constants/maps";
import { buildDiscordText, type ShareTeam } from "@/domain/discord";
import {
  currentTurn,
  DRAFT_ORDER,
  openRoles,
  openSlots,
  pickTopCaptains,
  playerStrength,
} from "@/domain/draft";
import {
  assembleTeam,
  type BuiltTeam,
  buildBalancedTeams,
  type Candidate,
  type MapSelection,
  type Participant,
  selectMap,
} from "@/domain/team-builder";
import type { BuildMode, Role } from "@/domain/types";
import type { MatchPreset } from "@/lib/presets";
import { cn } from "@/lib/utils";
import {
  type CreateMatchInput,
  createMatch,
  loadPresetMembers,
  type SavedMatch,
  saveResult,
  updateMapBan,
} from "../actions";
import { type BanTeam, HeroBanPicker } from "./hero-ban-picker";
import { MapRoulette } from "./map-roulette";

type Step =
  | "select"
  | "mode"
  | "captains"
  | "captainPos"
  | "draft"
  | "confirm"
  | "map"
  | "ban"
  | "review"
  | "result"
  | "next";

/** 드래프트 배정 1건 (팀장 모드) */
interface DraftAssign {
  participant: Participant;
  role: Role;
  /** 1~8 픽 순서. 팀장은 null */
  pickOrder: number | null;
  isCaptain: boolean;
}

const ROLES: Role[] = ["tank", "dps", "support"];

/** 주 역할 정렬 순위 (탱→딜→힐, 미지정은 맨 뒤) */
const partRoleRank = (p: Participant): number =>
  p.primaryRole ? ROLE_ORDER[p.primaryRole] : 99;

const SELECT_SORTS: { key: "role" | "score" | "joined"; label: string }[] = [
  { key: "role", label: "역할순" },
  { key: "score", label: "점수순" },
  { key: "joined", label: "가입순" },
];

const selectClass =
  "h-9 rounded-lg border border-input bg-surface-2 px-2.5 text-sm text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:dark]";

const MODES: {
  value: BuildMode;
  title: string;
  desc: string;
  ready: boolean;
}[] = [
  {
    value: "basic",
    title: "기본 (자동 밸런스)",
    desc: "균형 잡힌 두 팀을 시스템이 자동 생성",
    ready: true,
  },
  {
    value: "captain_top",
    title: "팀장 — 최고티어",
    desc: "점수 상위 2명을 팀장으로 → 스네이크 드래프트",
    ready: true,
  },
  {
    value: "captain_manual",
    title: "팀장 — 직접 지정",
    desc: "관리자가 팀장 2명을 선택 → 스네이크 드래프트",
    ready: true,
  },
];

function toCreateInput(
  c: Candidate,
  mode: BuildMode,
  draft?: { A: DraftAssign[]; B: DraftAssign[] } | null,
): CreateMatchInput {
  const team = (t: BuiltTeam, side: "A" | "B") => {
    const assigns = draft?.[side];
    return {
      side,
      captainId: assigns?.find((a) => a.isCaptain)?.participant.id ?? null,
      totalScore: t.totalScore,
      comboBonus: t.comboBonus,
      comboPenalty: t.comboPenalty,
      finalScore: t.finalScore,
      members: t.members.map((m) => ({
        memberId: m.participant.id,
        assignedRole: m.role,
        individualScore: m.individualScore,
        pickOrder:
          assigns?.find((a) => a.participant.id === m.participant.id)
            ?.pickOrder ?? null,
      })),
    };
  };
  return { buildMode: mode, teams: [team(c.teamA, "A"), team(c.teamB, "B")] };
}

function shareTeam(t: BuiltTeam, label: string): ShareTeam {
  return {
    label,
    finalScore: t.finalScore,
    members: t.members.map((m) => ({
      battleTag: m.participant.battleTag,
      role: m.role,
    })),
  };
}

/** 밴 카드에 함께 보여줄 팀 로스터로 변환 */
function toBanTeam(t: BuiltTeam, byId: Map<string, Participant>): BanTeam {
  return {
    members: t.members.map((m) => ({
      id: m.participant.id,
      battleTag:
        byId.get(m.participant.id)?.battleTag ?? m.participant.battleTag,
      role: m.role,
    })),
  };
}

export function MatchWizard({
  participants,
  presets,
  rulesBody,
}: {
  participants: Participant[];
  presets: MatchPreset[];
  rulesBody: string;
}) {
  const router = useRouter();
  const { heroByCode, mapByCode, heroes, maps } = useRefData();
  const activeMapCodes = maps.filter((m) => m.isActive).map((m) => m.code);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectSort, setSelectSort] = useState<"role" | "score" | "joined">(
    "role",
  );
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetLoadingId, setPresetLoadingId] = useState<string | null>(null);
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [mode, setMode] = useState<BuildMode>("basic");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [saved, setSaved] = useState<SavedMatch | null>(null);
  const [mapSel, setMapSel] = useState<MapSelection | null>(null);
  const [mapNonce, setMapNonce] = useState(0); // 추첨 연출 재시작용 key
  const [banA, setBanA] = useState("");
  const [banB, setBanB] = useState("");
  const [winner, setWinner] = useState<"A" | "B" | "draw">("A");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [memo, setMemo] = useState("");
  const [heroInputs, setHeroInputs] = useState<Record<string, string[]>>({});

  // 팀장 드래프트 상태
  const [captainIds, setCaptainIds] = useState<string[]>([]); // 직접지정 선택 버퍼
  const [captainAId, setCaptainAId] = useState<string | null>(null);
  const [captainBId, setCaptainBId] = useState<string | null>(null);
  const [capRoleA, setCapRoleA] = useState<Role | null>(null);
  const [capRoleB, setCapRoleB] = useState<Role | null>(null);
  const [draftA, setDraftA] = useState<DraftAssign[]>([]);
  const [draftB, setDraftB] = useState<DraftAssign[]>([]);
  const [pickIndex, setPickIndex] = useState(0);

  const selectedParticipants = useMemo(
    () =>
      selected.map((id) => byId.get(id)).filter((p): p is Participant => !!p),
    [selected, byId],
  );

  // 워크플로우 진입 시 영웅·맵 이미지를 미리 로드 → 맵 추첨·밴 단계에서 즉시 표시
  useEffect(() => {
    preloadGameImages(heroes, maps);
  }, [heroes, maps]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 10
          ? prev
          : [...prev, id],
    );
  }

  /** 프리셋(✅ 반응자)으로 참가자 자동 선택. 최대 10명까지 채운다. */
  function applyPreset(preset: MatchPreset) {
    setPresetLoadingId(preset.id);
    loadPresetMembers(preset.id)
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        const valid = res.data.memberIds.filter((id) => byId.has(id));
        setSelected(valid.slice(0, 10));
        setUnmatchedNames(res.data.unmatchedNames);
        setPresetOpen(false);
        const capped = valid.length > 10 ? " (10명 초과분 제외)" : "";
        const skipped =
          res.data.unmatchedNames.length > 0
            ? ` · 미등록 ${res.data.unmatchedNames.length}명은 직접 선택`
            : "";
        if (valid.length === 0 && res.data.unmatchedNames.length === 0) {
          toast.error("✅ 누른 참가자가 없어요");
        } else if (valid.length === 0) {
          toast.error("✅ 참가자가 모두 미등록이에요 — 아래 명단 참고");
        } else {
          toast.success(`${valid.length}명 선택했어요${capped}${skipped}`);
        }
      })
      .catch(() => toast.error("프리셋을 불러오지 못했습니다"))
      .finally(() => setPresetLoadingId(null));
  }

  function build() {
    const c = buildBalancedTeams(selectedParticipants);
    if (!c) {
      toast.error(
        "유효한 팀 조합을 만들 수 없습니다. 포지션별 티어를 확인하거나 팀장 직접 지정 모드를 사용하세요.",
      );
      return;
    }
    setCandidate(c);
    setStep("confirm");
  }

  function rollMap() {
    setMapSel(selectMap(selectedParticipants, activeMapCodes));
    setMapNonce((n) => n + 1); // 매번 추첨 연출 재시작
  }

  function resetDraft() {
    setCaptainIds([]);
    setCaptainAId(null);
    setCaptainBId(null);
    setCapRoleA(null);
    setCapRoleB(null);
    setDraftA([]);
    setDraftB([]);
    setPickIndex(0);
  }

  function chooseMode(value: BuildMode) {
    setMode(value);
    resetDraft();
    if (value === "basic") {
      build();
      return;
    }
    if (value === "captain_top") {
      const [c1, c2] = pickTopCaptains(selectedParticipants);
      setCaptainAId(c1.id);
      setCaptainBId(c2.id);
      setStep("captainPos");
      return;
    }
    setStep("captains"); // captain_manual
  }

  function confirmManualCaptains() {
    if (captainIds.length !== 2) return;
    setCaptainAId(captainIds[0]);
    setCaptainBId(captainIds[1]);
    setCapRoleA(null);
    setCapRoleB(null);
    setStep("captainPos");
  }

  function startDraft() {
    const a = captainAId ? byId.get(captainAId) : null;
    const b = captainBId ? byId.get(captainBId) : null;
    if (!a || !b || !capRoleA || !capRoleB) return;

    setDraftA([
      { participant: a, role: capRoleA, pickOrder: null, isCaptain: true },
    ]);
    setDraftB([
      { participant: b, role: capRoleB, pickOrder: null, isCaptain: true },
    ]);
    setPickIndex(0);
    setStep("draft");
  }

  function finalizeDraft(a: DraftAssign[], b: DraftAssign[]) {
    const toMembers = (list: DraftAssign[]) =>
      list.map((x) => ({ participant: x.participant, role: x.role }));
    const teamA = assembleTeam(toMembers(a));
    const teamB = assembleTeam(toMembers(b));
    setCandidate({
      teamA,
      teamB,
      diff: Math.abs(teamA.finalScore - teamB.finalScore),
    });
    setStep("confirm");
  }

  function draftPick(player: Participant, role: Role) {
    const turn = currentTurn(pickIndex);
    if (!turn) return;
    const assign: DraftAssign = {
      participant: player,
      role,
      pickOrder: pickIndex + 1,
      isCaptain: false,
    };
    const next = pickIndex + 1;
    let nextA = draftA;
    let nextB = draftB;
    if (turn === "A") {
      nextA = [...draftA, assign];
      setDraftA(nextA);
    } else {
      nextB = [...draftB, assign];
      setDraftB(nextB);
    }
    setPickIndex(next);
    if (next >= DRAFT_ORDER.length) finalizeDraft(nextA, nextB);
  }

  function undoPick() {
    if (pickIndex === 0) return;
    const lastOrder = pickIndex;
    const turn = DRAFT_ORDER[pickIndex - 1];
    if (turn === "A")
      setDraftA((prev) => prev.filter((a) => a.pickOrder !== lastOrder));
    else setDraftB((prev) => prev.filter((a) => a.pickOrder !== lastOrder));
    setPickIndex(pickIndex - 1);
  }

  function redraft() {
    setCapRoleA(null);
    setCapRoleB(null);
    setDraftA([]);
    setDraftB([]);
    setPickIndex(0);
    setStep("captainPos");
  }

  const draftData = mode === "basic" ? null : { A: draftA, B: draftB };

  function confirmTeams() {
    if (!candidate) return;
    startTransition(async () => {
      const res = await createMatch(toCreateInput(candidate, mode, draftData));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(res.data);
      rollMap();
      setBanA("");
      setBanB("");
      setStep("map");
    });
  }

  function replaySameTeams() {
    if (!candidate) return;
    startTransition(async () => {
      const res = await createMatch(toCreateInput(candidate, mode, draftData));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(res.data);
      rollMap();
      setBanA("");
      setBanB("");
      resetResult();
      setStep("map");
    });
  }

  function resetResult() {
    setWinner("A");
    setScoreA("");
    setScoreB("");
    setMemo("");
    setHeroInputs({});
  }

  function saveMapBan() {
    if (!saved || !mapSel) return;
    const aCode = banA || null;
    const bCode = banB || null;
    startTransition(async () => {
      const res = await updateMapBan(
        saved.matchId,
        mapSel.mapCode,
        aCode,
        bCode,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStep("result");
    });
  }

  function submitResult() {
    if (!saved) return;
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
    const heroes: Record<string, string[]> = {};
    for (const [tmId, codes] of Object.entries(heroInputs)) {
      if (codes.length) heroes[tmId] = codes;
    }
    startTransition(async () => {
      const res = await saveResult(saved.matchId, {
        winnerSide: winner === "draw" ? null : winner,
        scoreA: a,
        scoreB: b,
        memo: memo.trim() || null,
        heroes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("결과를 저장했습니다");
      setStep("next");
    });
  }

  function copyShare() {
    if (!candidate) return;
    const text = buildDiscordText(
      {
        teamA: shareTeam(candidate.teamA, "A팀"),
        teamB: shareTeam(candidate.teamB, "B팀"),
        mapCode: mapSel?.mapCode ?? null,
        banA: banA || null,
        banB: banB || null,
      },
      {
        heroName: (c) => heroByCode[c]?.nameKo,
        mapName: (c) => mapByCode[c]?.nameKo,
      },
    );
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("디스코드용 텍스트를 복사했습니다"))
      .catch(() => toast.error("복사에 실패했습니다"));
  }

  // ── 렌더 ──────────────────────────────────────────────
  if (step === "select") {
    const filtered = search.trim()
      ? participants.filter(
          (p) =>
            p.battleTag.includes(search.trim()) ||
            p.discordName?.includes(search.trim()),
        )
      : participants;
    const sortedSelect =
      selectSort === "joined"
        ? filtered
        : [...filtered].sort((a, b) =>
            selectSort === "score"
              ? playerStrength(b) - playerStrength(a)
              : partRoleRank(a) - partRoleRank(b) ||
                playerStrength(b) - playerStrength(a),
          );
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 sm:max-w-md sm:flex-1">
            <Input
              placeholder="멤버 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={presets.length === 0}
              onClick={() => setPresetOpen(true)}
            >
              프리셋 불러오기
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <SortSelect
              value={selectSort}
              options={SELECT_SORTS}
              onChange={setSelectSort}
              className="w-36"
            />
            <span
              className={cn(
                "shrink-0 text-sm tabular-nums",
                selected.length === 10 ? "text-success" : "text-ink-subtle",
              )}
            >
              {selected.length} / 10
            </span>
            <Button
              disabled={selected.length !== 10}
              onClick={() => setStep("mode")}
            >
              다음
            </Button>
          </div>
        </div>

        {unmatchedNames.length > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm">
            <p className="font-medium text-ink">
              ✅ 눌렀지만 미등록·미연결 {unmatchedNames.length}명 — 아래에서
              직접 선택하거나 멤버 등록이 필요해요
            </p>
            <p className="mt-1 text-ink-subtle">{unmatchedNames.join(", ")}</p>
          </div>
        )}

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSelect.map((p) => {
            const active = selected.includes(p.id);
            const ratedRoles = ROLES.filter((r) => p.ratings[r] != null);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-lg border px-3.5 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {active ? "✓" : ""}
                      </span>
                      <span className="truncate font-medium">
                        {p.battleTag}
                      </span>
                    </span>
                    {p.primaryRole && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 pl-1.5"
                      >
                        <RoleIcon role={p.primaryRole} size={13} />
                        {ROLE_LABEL_KO[p.primaryRole]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ratedRoles.length === 0 ? (
                      <span className="text-xs text-ink-subtle">
                        티어 미입력
                      </span>
                    ) : (
                      ratedRoles.map((r) => (
                        <span
                          key={r}
                          className="rounded bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-ink-subtle"
                        >
                          {ROLE_LABEL_KO[r]} {p.ratings[r]}
                        </span>
                      ))
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>프리셋 불러오기</DialogTitle>
              <DialogDescription>
                /내전 으로 올린 모집글을 고르면 ✅ 누른 멤버가 자동 선택돼요.
              </DialogDescription>
            </DialogHeader>
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {presets.map((preset) => (
                <li key={preset.id}>
                  <button
                    type="button"
                    disabled={presetLoadingId !== null}
                    onClick={() => applyPreset(preset)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3.5 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-primary">
                        #{preset.code}
                      </span>
                      <span className="font-medium">
                        {preset.label || "내전 모집"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-subtle">
                      {presetLoadingId === preset.id
                        ? "불러오는 중…"
                        : new Date(preset.createdAt).toLocaleDateString(
                            "ko-KR",
                            {
                              month: "numeric",
                              day: "numeric",
                            },
                          )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (step === "mode") {
    return (
      <div className="flex flex-col gap-4">
        <BackBar onBack={() => setStep("select")} label="참가자 선택" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={!m.ready}
              onClick={() => chooseMode(m.value)}
              className="text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Card className="h-full transition-colors hover:bg-surface-2">
                <CardHeader>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <CardDescription>{m.desc}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "captains") {
    return (
      <div className="flex flex-col gap-4">
        <BackBar onBack={() => setStep("mode")} label="모드 선택" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-subtle">팀장 2명을 선택하세요</p>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm tabular-nums",
                captainIds.length === 2 ? "text-success" : "text-ink-subtle",
              )}
            >
              {captainIds.length} / 2
            </span>
            <Button
              disabled={captainIds.length !== 2}
              onClick={confirmManualCaptains}
            >
              다음
            </Button>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {selectedParticipants.map((p) => {
            const active = captainIds.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() =>
                    setCaptainIds((prev) =>
                      prev.includes(p.id)
                        ? prev.filter((x) => x !== p.id)
                        : prev.length >= 2
                          ? prev
                          : [...prev, p.id],
                    )
                  }
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-surface-2",
                  )}
                >
                  <span className="font-medium">{p.battleTag}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ROLES.filter((r) => p.ratings[r] != null).map((r) => (
                      <span key={r} className="text-xs text-ink-subtle">
                        {ROLE_LABEL_KO[r]} {p.ratings[r]}
                      </span>
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (step === "captainPos") {
    const capA = captainAId ? byId.get(captainAId) : null;
    const capB = captainBId ? byId.get(captainBId) : null;
    const posPicker = (
      cap: Participant | null | undefined,
      value: Role | null,
      onPick: (r: Role) => void,
      tone: "a" | "b",
    ) =>
      cap ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            tone === "a" ? "border-team-a/40" : "border-team-b/40",
          )}
        >
          <p className="font-medium">
            {tone === "a" ? "A팀 팀장" : "B팀 팀장"} · {cap.battleTag}
          </p>
          <div className="mt-2 flex gap-2">
            {ROLES.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={value === r ? "default" : "secondary"}
                onClick={() => onPick(r)}
                className="gap-1.5"
              >
                <RoleIcon role={r} size={14} />
                {ROLE_LABEL_KO[r]} {cap.ratings[r] ?? "비선호"}
              </Button>
            ))}
          </div>
        </div>
      ) : null;

    return (
      <div className="flex flex-col gap-4">
        <BackBar
          onBack={() =>
            setStep(mode === "captain_manual" ? "captains" : "mode")
          }
          label={mode === "captain_manual" ? "팀장 선택" : "모드 선택"}
        />
        <h2 className="text-lg font-medium">팀장 포지션 지정</h2>
        <p className="-mt-2 text-sm text-ink-subtle">
          각 팀장이 맡을 포지션을 먼저 정합니다. (안 하는 포지션도 배정 가능)
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {posPicker(capA, capRoleA, setCapRoleA, "a")}
          {posPicker(capB, capRoleB, setCapRoleB, "b")}
        </div>
        <div className="flex justify-end">
          <Button onClick={startDraft} disabled={!capRoleA || !capRoleB}>
            드래프트 시작
          </Button>
        </div>
      </div>
    );
  }

  if (step === "draft") {
    const turn = currentTurn(pickIndex);
    const draftedIds = new Set(
      [...draftA, ...draftB].map((a) => a.participant.id),
    );
    // 픽 후보: 대표 점수(역할 중 최고) 내림차순 → 동점은 탱·딜·힐 순
    const pool = selectedParticipants
      .filter((p) => !draftedIds.has(p.id))
      .sort(
        (a, b) =>
          playerStrength(b) - playerStrength(a) ||
          partRoleRank(a) - partRoleRank(b),
      );
    const activeTeam = turn === "A" ? draftA : draftB;
    const activeOpenRoles = openRoles(activeTeam);
    const scoreOf = (list: DraftAssign[]) =>
      list.length
        ? assembleTeam(
            list.map((x) => ({ participant: x.participant, role: x.role })),
          ).totalScore
        : 0;

    const teamPanel = (list: DraftAssign[], label: string, tone: "a" | "b") => (
      <div
        className={cn(
          "rounded-lg border px-3 py-2",
          tone === "a" ? "border-team-a/40" : "border-team-b/40",
          turn === (tone === "a" ? "A" : "B") && "ring-1 ring-primary",
        )}
      >
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-medium">
            {label} {turn === (tone === "a" ? "A" : "B") && "← 차례"}
          </span>
          <AnimatedNumber
            value={scoreOf(list)}
            flash
            className="text-xs text-ink-subtle"
          />
        </div>
        <ul className="flex flex-col gap-0.5 text-sm">
          {[...list]
            .sort((x, y) => ROLE_ORDER[x.role] - ROLE_ORDER[y.role])
            .map((a) => (
              <li key={a.participant.id} className="flex justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <RoleIcon role={a.role} size={14} />
                  {a.participant.battleTag}
                  {a.isCaptain && " 🅒"}
                </span>
              </li>
            ))}
          {Object.entries(openSlots(list)).flatMap(([r, n]) =>
            Array.from({ length: n }, (_, i) => (
              <li
                key={`${r}-${i}`}
                className="flex items-center gap-1.5 text-ink-tertiary"
              >
                <RoleIcon role={r as Role} size={14} className="opacity-50" />
                {ROLE_LABEL_KO[r as Role]} (빈 슬롯)
              </li>
            )),
          )}
        </ul>
      </div>
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            스네이크 드래프트 · 픽 {Math.min(pickIndex + 1, DRAFT_ORDER.length)}
            /{DRAFT_ORDER.length}
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={redraft}>
              팀장 다시
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={undoPick}
              disabled={pickIndex === 0}
            >
              직전 픽 취소
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teamPanel(draftA, "A팀", "a")}
          {teamPanel(draftB, "B팀", "b")}
        </div>

        <p className="text-sm text-ink-subtle">
          {turn === "A" ? "A팀" : "B팀"} 팀장 차례 — 영입할 멤버의 포지션을
          누르세요
        </p>
        <ul className="flex flex-col gap-2">
          {pool.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-surface-1 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{p.battleTag}</span>
                  {p.primaryRole && (
                    <Badge variant="secondary" className="gap-1 pl-1.5">
                      <RoleIcon role={p.primaryRole} size={13} />주{" "}
                      {ROLE_LABEL_KO[p.primaryRole]}
                    </Badge>
                  )}
                  {p.secondaryRole && (
                    <Badge variant="outline" className="gap-1 pl-1.5">
                      <RoleIcon role={p.secondaryRole} size={13} />부{" "}
                      {ROLE_LABEL_KO[p.secondaryRole]}
                    </Badge>
                  )}
                  <span className="flex flex-wrap items-center gap-1">
                    {ROLES.filter((r) => p.ratings[r] != null).map((r) => (
                      <span
                        key={r}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs tabular-nums",
                          r === p.primaryRole
                            ? "bg-primary/15 text-ink"
                            : "bg-surface-2 text-ink-subtle",
                        )}
                      >
                        {ROLE_LABEL_KO[r]} {p.ratings[r]}
                      </span>
                    ))}
                  </span>
                </div>
                {p.heroCodes.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {p.heroCodes.map((code) => (
                      <span key={code} title={heroByCode[code]?.nameKo ?? code}>
                        <HeroImage
                          code={code}
                          size={30}
                          className="rounded-md ring-1 ring-border/60"
                        />
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-ink-tertiary">
                    선호 영웅 없음
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:flex-col sm:items-stretch">
                {activeOpenRoles.map((r) => {
                  const offRole = p.ratings[r] == null;
                  return (
                    <Button
                      key={r}
                      size="sm"
                      variant={offRole ? "ghost" : "secondary"}
                      onClick={() => draftPick(p, r)}
                      className="gap-1.5"
                    >
                      <RoleIcon role={r} size={14} />
                      {ROLE_LABEL_KO[r]}로 영입{offRole && " (비선호)"}
                    </Button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (step === "confirm" && candidate) {
    return (
      <div className="flex flex-col gap-4">
        <BackBar onBack={() => setStep("mode")} label="모드 선택" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TeamCard team={candidate.teamA} label="A팀" tone="a" byId={byId} />
          <TeamCard team={candidate.teamB} label="B팀" tone="b" byId={byId} />
        </div>
        <p className="text-center text-sm text-ink-subtle">
          점수차 <AnimatedNumber value={candidate.diff} />
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RulesModal body={rulesBody} label="📜 내전 규칙" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={copyShare}>
              디스코드 복사
            </Button>
            {mode === "basic" ? (
              <Button variant="secondary" onClick={build} disabled={pending}>
                재생성
              </Button>
            ) : (
              <Button variant="secondary" onClick={redraft} disabled={pending}>
                드래프트 다시
              </Button>
            )}
            <Button onClick={confirmTeams} disabled={pending}>
              {pending ? "저장 중…" : "팀 확정"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "map" && mapSel) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">맵 선정</h2>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <MapRoulette
            key={mapNonce}
            finalCode={mapSel.mapCode}
            fromFallback={mapSel.fromFallback}
            preferredBy={mapSel.preferredBy.map((p) => p.battleTag)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => rollMap()}>
            다시 추첨
          </Button>
          <Button onClick={() => setStep("ban")}>다음</Button>
        </div>
      </div>
    );
  }

  if (step === "ban") {
    return (
      <div className="flex flex-col gap-4">
        <BackBar onBack={() => setStep("map")} label="맵 선정" />
        <h2 className="text-lg font-medium">영웅 밴 (선택)</h2>
        <HeroBanPicker
          banA={banA}
          banB={banB}
          setBanA={setBanA}
          setBanB={setBanB}
          teamA={candidate ? toBanTeam(candidate.teamA, byId) : null}
          teamB={candidate ? toBanTeam(candidate.teamB, byId) : null}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={copyShare}>
            디스코드 복사
          </Button>
          <Button onClick={() => setStep("review")}>다음 (확인)</Button>
        </div>
      </div>
    );
  }

  if (step === "review" && candidate) {
    const map = mapSel ? mapByCode[mapSel.mapCode] : null;
    const diff = Math.abs(
      candidate.teamA.finalScore - candidate.teamB.finalScore,
    );
    return (
      <div className="flex flex-col gap-4">
        <BackBar onBack={() => setStep("ban")} label="영웅 밴" />
        <h2 className="text-lg font-medium">최종 대진표 확인</h2>

        {map ? (
          <div className="relative overflow-hidden rounded-xl border border-border/60">
            <MapImage code={map.code} cover className="aspect-video w-full" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-5">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-white/85">
                  <ModeIcon mode={map.mode} size={16} />
                  {MODE_LABEL_KO[map.mode]}
                </span>
                <span className="text-2xl font-bold text-white drop-shadow-md sm:text-3xl">
                  {map.nameKo}
                </span>
              </div>
              <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                선정 맵
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-ink-subtle">
            맵 미선정
          </div>
        )}

        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <MatchupTeam
            team={candidate.teamA}
            label="A팀"
            tone="a"
            banCode={banA}
            byId={byId}
          />
          <div className="flex items-center justify-center py-1">
            <span className="rounded-full border border-border/60 bg-surface-2 px-3 py-1 text-sm font-bold text-ink-subtle">
              VS
            </span>
          </div>
          <MatchupTeam
            team={candidate.teamB}
            label="B팀"
            tone="b"
            banCode={banB}
            byId={byId}
          />
        </div>

        <p className="text-center text-xs text-ink-subtle">
          점수차{" "}
          <span className="tabular-nums text-ink">{diff.toLocaleString()}</span>
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={copyShare}>
            디스코드 복사
          </Button>
          <Button onClick={saveMapBan} disabled={pending}>
            {pending ? "저장 중…" : "결과 입력으로 →"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "result" && saved) {
    return (
      <div className="flex flex-col gap-5">
        <BackBar onBack={() => setStep("review")} label="최종 확인" />
        <h2 className="text-lg font-medium">결과 입력</h2>

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
            <Label htmlFor="scoreA">A팀 스코어</Label>
            <Input
              id="scoreA"
              inputMode="numeric"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scoreB">B팀 스코어</Label>
            <Input
              id="scoreB"
              inputMode="numeric"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {saved.teams
            .slice()
            .sort((a, b) => a.side.localeCompare(b.side))
            .map((team) => (
              <div key={team.teamId} className="flex flex-col gap-2">
                <p className="text-sm font-medium">{team.side}팀</p>
                {team.members
                  .slice()
                  .sort(
                    (a, b) =>
                      ROLE_ORDER[a.assignedRole] - ROLE_ORDER[b.assignedRole],
                  )
                  .map((m) => {
                    const p = byId.get(m.memberId);
                    return (
                      <div
                        key={m.teamMemberId}
                        className="flex items-start gap-2"
                      >
                        <span className="flex w-28 shrink-0 items-center gap-1.5 pt-1.5 text-sm">
                          <RoleIcon role={m.assignedRole} size={14} />
                          <span className="truncate">
                            {p?.battleTag ?? m.memberId}
                          </span>
                        </span>
                        <HeroMultiSelect
                          className="flex-1"
                          role={m.assignedRole}
                          value={heroInputs[m.teamMemberId] ?? []}
                          onChange={(codes) =>
                            setHeroInputs((prev) => ({
                              ...prev,
                              [m.teamMemberId]: codes,
                            }))
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="memo">메모 (선택)</Label>
          <textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={copyShare}>
            디스코드 복사
          </Button>
          <Button onClick={submitResult} disabled={pending}>
            {pending ? "저장 중…" : "결과 저장"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "next") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">결과 저장 완료 — 다음은?</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="같은 팀으로 한 판 더"
            desc="현재 팀 유지, 맵·밴 다시"
            onClick={replaySameTeams}
            disabled={pending}
          />
          <ActionCard
            title="맵만 바꾸기"
            desc="팀 고정, 새 맵·밴"
            onClick={replaySameTeams}
            disabled={pending}
          />
          <ActionCard
            title="처음부터 재편성"
            desc="참가자 선택부터 다시"
            onClick={() => {
              setSelected([]);
              setUnmatchedNames([]);
              setCandidate(null);
              setSaved(null);
              setMode("basic");
              resetDraft();
              resetResult();
              setStep("select");
            }}
          />
          <ActionCard
            title="세션 종료"
            desc="대시보드로 돌아가기"
            onClick={() => router.push("/app")}
          />
        </div>
      </div>
    );
  }

  return null;
}

function BackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="self-start text-sm text-ink-subtle transition-colors hover:text-foreground"
    >
      ← {label}
    </button>
  );
}

function TeamCard({
  team,
  label,
  tone,
  byId,
}: {
  team: BuiltTeam;
  label: string;
  tone: "a" | "b";
  byId: Map<string, Participant>;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        tone === "a" ? "border-team-a/40" : "border-team-b/40",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <AnimatedNumber
          value={team.finalScore}
          className="text-sm text-ink-subtle"
        />
      </div>
      <ul className="flex flex-col gap-1">
        {team.members.map((m) => (
          <li
            key={m.participant.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-1.5">
              <RoleIcon role={m.role} size={14} />
              {byId.get(m.participant.id)?.battleTag ?? m.participant.battleTag}
            </span>
            <span className="tabular-nums text-ink-subtle">
              {m.individualScore.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      {team.comboPenalty > 0 && (
        <p className="mt-2 text-xs text-ink-subtle">
          조합 패널티 −{team.comboPenalty.toLocaleString()}
        </p>
      )}
    </div>
  );
}

/** 최종 대진표용 팀 패널 (헤더+멤버+밴, 팀 색상 강조) */
function MatchupTeam({
  team,
  label,
  tone,
  banCode,
  byId,
}: {
  team: BuiltTeam;
  label: string;
  tone: "a" | "b";
  banCode: string;
  byId: Map<string, Participant>;
}) {
  const { heroByCode } = useRefData();
  const isA = tone === "a";
  const ban = banCode ? heroByCode[banCode] : null;
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-surface-1",
        isA ? "border-team-a/40" : "border-team-b/40",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-3",
          isA ? "bg-team-a/10" : "bg-team-b/10",
        )}
      >
        <span
          className={cn(
            "text-base font-semibold",
            isA ? "text-team-a" : "text-team-b",
          )}
        >
          {label}
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums text-ink-subtle">
          {team.finalScore.toLocaleString()}점
        </span>
      </div>
      <ul className="flex flex-1 flex-col divide-y divide-border/40">
        {team.members.map((m) => (
          <li
            key={m.participant.id}
            className="flex items-center justify-between gap-2 px-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <RoleIcon role={m.role} size={20} />
              <span className="truncate text-[15px] font-medium">
                {byId.get(m.participant.id)?.battleTag ??
                  m.participant.battleTag}
              </span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-ink-subtle">
              {m.individualScore.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-border/40 bg-surface-2/40 px-4 py-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-3">
          {ban ? (
            <HeroImage code={ban.code} size={56} className="rounded-lg" />
          ) : (
            <span className="text-[11px] text-ink-tertiary">없음</span>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-ink-subtle">밴 영웅</span>
          <span className="font-medium">{ban ? ban.nameKo : "밴 없음"}</span>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  onClick,
  disabled,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left disabled:opacity-50"
    >
      <Card className="h-full transition-colors hover:bg-surface-2">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
      </Card>
    </button>
  );
}
