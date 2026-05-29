"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HeroImage } from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HERO_BY_CODE, HEROES, ROLE_LABEL_KO } from "@/constants/heroes";
import { MAPS, MODE_LABEL_KO } from "@/constants/maps";
import { TIER_LABEL_KO, TIER_ORDER } from "@/constants/tiers";
import type { GameMode, Role } from "@/domain/types";
import { cn } from "@/lib/utils";
import { saveMember } from "./actions";
import { type MemberFormValues, memberFormSchema } from "./schema";

const ROLES: Role[] = ["tank", "dps", "support"];
const DIVISIONS = [5, 4, 3, 2, 1];

export interface MemberView {
  id: string;
  battleTag: string;
  discordName: string | null;
  primaryRole: Role | null;
  secondaryRole: Role | null;
  ratings: { role: Role; tier: string; division: number }[];
  heroCodes: string[];
  mapCodes: string[];
}

interface RoleState {
  enabled: boolean;
  tier: string;
  division: number;
}

function initRatings(member?: MemberView): Record<Role, RoleState> {
  const base: Record<Role, RoleState> = {
    tank: { enabled: false, tier: "platinum", division: 3 },
    dps: { enabled: false, tier: "platinum", division: 3 },
    support: { enabled: false, tier: "platinum", division: 3 },
  };
  for (const r of member?.ratings ?? []) {
    base[r.role] = { enabled: true, tier: r.tier, division: r.division };
  }
  return base;
}

const selectClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export function MemberForm({
  member,
  trigger,
}: {
  member?: MemberView;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [battleTag, setBattleTag] = useState(member?.battleTag ?? "");
  const [discordName, setDiscordName] = useState(member?.discordName ?? "");
  const [primaryRole, setPrimaryRole] = useState<string>(
    member?.primaryRole ?? "",
  );
  const [secondaryRole, setSecondaryRole] = useState<string>(
    member?.secondaryRole ?? "",
  );
  const [ratings, setRatings] = useState(() => initRatings(member));
  const [heroCodes, setHeroCodes] = useState<string[]>(member?.heroCodes ?? []);
  const [mapCodes, setMapCodes] = useState<string[]>(member?.mapCodes ?? []);
  const [heroQuery, setHeroQuery] = useState("");

  function reset() {
    setBattleTag(member?.battleTag ?? "");
    setDiscordName(member?.discordName ?? "");
    setPrimaryRole(member?.primaryRole ?? "");
    setSecondaryRole(member?.secondaryRole ?? "");
    setRatings(initRatings(member));
    setHeroCodes(member?.heroCodes ?? []);
    setMapCodes(member?.mapCodes ?? []);
    setHeroQuery("");
  }

  function setRole(role: Role, patch: Partial<RoleState>) {
    setRatings((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  function toggleHero(code: string) {
    setHeroCodes((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 5
          ? prev
          : [...prev, code],
    );
  }

  function toggleMap(code: string) {
    setMapCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function onSubmit() {
    const values: MemberFormValues = {
      memberId: member?.id,
      battleTag: battleTag.trim(),
      discordName: discordName.trim() || undefined,
      primaryRole: (primaryRole || null) as Role | null,
      secondaryRole: (secondaryRole || null) as Role | null,
      ratings: ROLES.filter((r) => ratings[r].enabled).map((r) => ({
        role: r,
        tier: ratings[r].tier as MemberFormValues["ratings"][number]["tier"],
        division: ratings[r].division,
      })),
      heroCodes,
      mapCodes,
    };

    const parsed = memberFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요");
      return;
    }

    startTransition(async () => {
      const res = await saveMember(parsed.data);
      if (res.ok) {
        toast.success(
          member ? "멤버 정보를 수정했습니다" : "멤버를 등록했습니다",
        );
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const filteredHeroes = heroQuery.trim()
    ? HEROES.filter((h) => h.nameKo.includes(heroQuery.trim()))
    : HEROES;
  const mapsByMode = groupMaps();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "멤버 수정" : "멤버 등록"}</DialogTitle>
          <DialogDescription>
            배틀태그·티어·선호는 이 채널에만 적용됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* 신원 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="battleTag">배틀태그</Label>
              <Input
                id="battleTag"
                placeholder="홍길동#1234"
                value={battleTag}
                onChange={(e) => setBattleTag(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discordName">디스코드 이름 (선택)</Label>
              <Input
                id="discordName"
                placeholder="디코 닉네임"
                value={discordName}
                onChange={(e) => setDiscordName(e.target.value)}
              />
            </div>
          </div>

          {/* 주/부 포지션 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primaryRole">주 포지션 (선택)</Label>
              <select
                id="primaryRole"
                className={selectClass}
                value={primaryRole}
                onChange={(e) => setPrimaryRole(e.target.value)}
              >
                <option value="">없음</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL_KO[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="secondaryRole">부 포지션 (선택)</Label>
              <select
                id="secondaryRole"
                className={selectClass}
                value={secondaryRole}
                onChange={(e) => setSecondaryRole(e.target.value)}
              >
                <option value="">없음</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL_KO[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 역할별 티어 */}
          <div className="flex flex-col gap-2">
            <Label>역할별 티어</Label>
            <p className="-mt-1 text-xs text-ink-subtle">
              하는 포지션만 체크하세요. 티어 없는 역할은 팀 배정에서 제외됩니다.
            </p>
            <div className="flex flex-col gap-2">
              {ROLES.map((r) => {
                const state = ratings[r];
                return (
                  <div
                    key={r}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <label className="flex w-16 shrink-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={state.enabled}
                        onChange={(e) =>
                          setRole(r, { enabled: e.target.checked })
                        }
                        className="size-4 accent-primary"
                      />
                      {ROLE_LABEL_KO[r]}
                    </label>
                    <select
                      className={cn(selectClass, "flex-1")}
                      value={state.tier}
                      disabled={!state.enabled}
                      onChange={(e) => setRole(r, { tier: e.target.value })}
                    >
                      {TIER_ORDER.map((t) => (
                        <option key={t} value={t}>
                          {TIER_LABEL_KO[t]}
                        </option>
                      ))}
                    </select>
                    <select
                      className={cn(selectClass, "w-20")}
                      value={state.division}
                      disabled={!state.enabled}
                      onChange={(e) =>
                        setRole(r, { division: Number(e.target.value) })
                      }
                    >
                      {DIVISIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}티어
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선호 영웅 */}
          <div className="flex flex-col gap-2">
            <Label>선호 영웅 ({heroCodes.length}/5)</Label>

            {/* 선택된 영웅 — 항상 보이게 상단에, 클릭하면 제거 */}
            {heroCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {heroCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleHero(code)}
                    title="클릭하면 제거"
                  >
                    <Badge
                      variant="default"
                      className="h-8 cursor-pointer gap-1 pr-3 pl-1 text-sm"
                    >
                      <HeroImage code={code} size={22} />
                      {HERO_BY_CODE[code]?.nameKo ?? code}
                      <span aria-hidden>×</span>
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-subtle">
                아래에서 최대 5개까지 선택하세요.
              </p>
            )}

            <Input
              placeholder="영웅 이름 검색"
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
            />

            {/* 역할별 그룹 — 선택된 건 강조. 내부 스크롤 없이 다이얼로그가 스크롤 */}
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
              {ROLES.map((role) => {
                const list = filteredHeroes.filter((h) => h.role === role);
                if (list.length === 0) return null;
                return (
                  <div key={role} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-subtle">
                      {ROLE_LABEL_KO[role]}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {list.map((h) => {
                        const active = heroCodes.includes(h.code);
                        const disabled = !active && heroCodes.length >= 5;
                        return (
                          <button
                            key={h.code}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleHero(h.code)}
                          >
                            <Badge
                              variant={active ? "secondary" : "outline"}
                              className={cn(
                                "h-8 cursor-pointer gap-1 pr-3 pl-1 text-sm",
                                active && "ring-1 ring-primary",
                                disabled && "cursor-not-allowed opacity-40",
                              )}
                            >
                              <HeroImage code={h.code} size={22} />
                              {h.nameKo}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선호 맵 */}
          <div className="flex flex-col gap-2">
            <Label>선호 맵 ({mapCodes.length})</Label>
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-2">
              {mapsByMode.map(({ mode, maps }) => (
                <div key={mode} className="flex flex-col gap-1">
                  <span className="text-xs text-ink-subtle">
                    {MODE_LABEL_KO[mode]}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {maps.map((m) => {
                      const active = mapCodes.includes(m.code);
                      return (
                        <button
                          key={m.code}
                          type="button"
                          onClick={() => toggleMap(m.code)}
                        >
                          <Badge
                            variant={active ? "default" : "outline"}
                            className="cursor-pointer"
                          >
                            {m.nameKo}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupMaps(): { mode: GameMode; maps: typeof MAPS }[] {
  const order: GameMode[] = [
    "control",
    "escort",
    "hybrid",
    "push",
    "flashpoint",
    "clash",
  ];
  return order
    .map((mode) => ({
      mode,
      maps: MAPS.filter((m) => m.mode === mode && m.isActive),
    }))
    .filter((g) => g.maps.length > 0);
}
