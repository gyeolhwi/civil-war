"use client";

import { useState } from "react";
import { useRefData } from "@/components/ref-data-provider";
import { Button } from "@/components/ui/button";
import { HeroImage, RoleIcon } from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["tank", "dps", "support"];

/** 밴 카드에 함께 표시할 팀 로스터 */
export type BanTeam = {
  members: { id: string; battleTag: string; role: Role }[];
} | null;

/**
 * 영웅 밴 카드 피커. 상단 A/B 밴 슬롯(활성 팀 토글) + 영웅 카드 그리드.
 * 활성 팀(슬롯 클릭으로 전환) 기준으로 미밴 영웅 클릭 → 밴, 밴된 영웅 클릭 → 해제(토글).
 * 한 영웅은 한 팀만 밴 가능(밴된 영웅 재클릭은 항상 해제라 중복 밴 불가).
 */
export function HeroBanPicker({
  banA,
  banB,
  setBanA,
  setBanB,
  teamA = null,
  teamB = null,
}: {
  banA: string;
  banB: string;
  setBanA: (c: string) => void;
  setBanB: (c: string) => void;
  teamA?: BanTeam;
  teamB?: BanTeam;
}) {
  const { heroByCode, heroesByRole } = useRefData();
  const [target, setTarget] = useState<"A" | "B">("A");
  const [query, setQuery] = useState("");
  const q = query.trim();

  function pick(code: string) {
    // 밴된 영웅을 다시 누르면(어느 팀이든) 해제 — 토글. 비워진 팀이 다음 차례
    if (code === banA) {
      setBanA("");
      setTarget("A");
      return;
    }
    if (code === banB) {
      setBanB("");
      setTarget("B");
      return;
    }
    // 미밴 영웅 → 활성 팀이 밴 후, 아직 빈 팀이 있으면 자동으로 그쪽으로 전환
    if (target === "A") {
      setBanA(code);
      setTarget(banB ? "A" : "B");
    } else {
      setBanB(code);
      setTarget(banA ? "B" : "A");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A/B 팀 카드 = 밴 슬롯 + 로스터 (헤더 클릭 = 밴 대상 지정) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["A", "B"] as const).map((side) => {
          const code = side === "A" ? banA : banB;
          const hero = code ? heroByCode[code] : null;
          const active = target === side;
          const team = side === "A" ? teamA : teamB;
          const isA = side === "A";
          const clear = () => (isA ? setBanA("") : setBanB(""));
          return (
            <div
              key={side}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border-2 bg-surface-1 transition-all",
                active
                  ? "border-primary"
                  : isA
                    ? "border-team-a/40"
                    : "border-team-b/40",
              )}
            >
              <button
                type="button"
                onClick={() => setTarget(side)}
                className={cn(
                  "flex w-full items-center gap-3 p-3 text-left transition-colors",
                  active ? "bg-primary/10" : "hover:bg-surface-2",
                )}
              >
                {hero ? (
                  <HeroImage code={code} size={52} className="rounded-lg" />
                ) : (
                  <span className="flex size-13 items-center justify-center rounded-lg bg-surface-3 text-2xl text-ink-subtle">
                    🚫
                  </span>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span
                      className={cn(
                        "font-semibold",
                        isA ? "text-team-a" : "text-team-b",
                      )}
                    >
                      {side}팀
                    </span>
                    <span className="text-ink-subtle">밴</span>
                    {active && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        지정 중
                      </span>
                    )}
                  </span>
                  <span className="truncate text-base font-semibold">
                    {hero?.nameKo ?? "밴 없음"}
                  </span>
                </span>
              </button>
              {hero && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5"
                  onClick={clear}
                >
                  ✕
                </Button>
              )}
              {team && team.members.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border/40 px-3 py-3">
                  {ROLES.map((role) => {
                    const inRole = team.members.filter((m) => m.role === role);
                    if (inRole.length === 0) return null;
                    return (
                      <div key={role} className="flex items-center gap-2.5">
                        <RoleIcon
                          role={role}
                          size={18}
                          className="shrink-0 opacity-80"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {inRole.map((m) => (
                            <span
                              key={m.id}
                              className="rounded-md bg-surface-2 px-2.5 py-1 text-sm font-medium"
                            >
                              {m.battleTag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-ink-subtle">
        영웅을 누르면{" "}
        <span className="font-medium text-foreground">{target}팀</span>이 밴 (빈
        팀으로 자동 전환) · 밴된 영웅 다시 누르면 해제 · 팀 직접 지정은 카드
        클릭
      </p>

      <Input
        placeholder="영웅 이름 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* 영웅 카드 그리드 (역할별, 큰 초상) */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 p-3">
        {ROLES.map((role) => {
          const list = heroesByRole[role].filter(
            (h) => !q || h.nameKo.includes(q),
          );
          if (list.length === 0) return null;
          return (
            <div key={role} className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink-subtle">
                <RoleIcon role={role} size={16} />
                {ROLE_LABEL_KO[role]}
              </span>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
                {list.map((h) => {
                  const banSide =
                    h.code === banA ? "A" : h.code === banB ? "B" : null;
                  return (
                    <button
                      key={h.code}
                      type="button"
                      onClick={() => pick(h.code)}
                      title={
                        banSide ? `${banSide}팀 밴 (눌러서 해제)` : h.nameKo
                      }
                      className={cn(
                        "group flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all",
                        banSide === target
                          ? "border-primary bg-primary/10"
                          : banSide
                            ? "border-destructive/50 bg-destructive/10"
                            : "border-transparent hover:border-border hover:bg-surface-2",
                      )}
                    >
                      <span className="relative">
                        <HeroImage
                          code={h.code}
                          size={60}
                          className="rounded-lg transition-transform group-hover:scale-105"
                        />
                        {banSide && (
                          <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white ring-2 ring-background">
                            {banSide}
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate text-center text-xs">
                        {h.nameKo}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
