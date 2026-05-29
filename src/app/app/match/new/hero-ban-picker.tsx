"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HeroImage } from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import {
  HERO_BY_CODE,
  HEROES_BY_ROLE,
  ROLE_LABEL_KO,
} from "@/constants/heroes";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["tank", "dps", "support"];

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
}: {
  banA: string;
  banB: string;
  setBanA: (c: string) => void;
  setBanB: (c: string) => void;
}) {
  const [target, setTarget] = useState<"A" | "B">("A");
  const [query, setQuery] = useState("");
  const q = query.trim();

  function pick(code: string) {
    // 밴된 영웅을 다시 누르면(어느 팀이든) 해제 — 토글
    if (code === banA) {
      setBanA("");
      return;
    }
    if (code === banB) {
      setBanB("");
      return;
    }
    // 미밴 영웅 → 활성 팀이 밴 (기존 밴 있으면 교체). 중복 밴은 위 토글로 차단됨
    if (target === "A") setBanA(code);
    else setBanB(code);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A/B 밴 슬롯 (큰 초상) */}
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((side) => {
          const code = side === "A" ? banA : banB;
          const hero = code ? HERO_BY_CODE[code] : null;
          const active = target === side;
          const clear = () => (side === "A" ? setBanA("") : setBanB(""));
          return (
            <button
              key={side}
              type="button"
              onClick={() => setTarget(side)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:bg-surface-2",
              )}
            >
              {hero ? (
                <HeroImage code={code} size={56} className="rounded-lg" />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-lg bg-surface-3 text-2xl text-ink-subtle">
                  🚫
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  {side}팀 밴
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
              {hero && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    clear();
                  }}
                >
                  ✕
                </Button>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-subtle">
        <span className="font-medium text-foreground">{target}팀</span>이 밴할
        영웅을 누르세요 · 밴된 영웅을 다시 누르면 해제 · 팀 전환은 위 슬롯 클릭
      </p>

      <Input
        placeholder="영웅 이름 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* 영웅 카드 그리드 (역할별, 큰 초상) */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 p-3">
        {ROLES.map((role) => {
          const list = HEROES_BY_ROLE[role].filter(
            (h) => !q || h.nameKo.includes(q),
          );
          if (list.length === 0) return null;
          return (
            <div key={role} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-ink-subtle">
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
