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
 * 영웅 밴 카드 피커. 상단에 A/B 밴 슬롯(큰 초상), 아래에 영웅 카드 그리드.
 * 슬롯을 눌러 지정 대상 팀 선택 → 카드 클릭으로 밴(같은 카드 재클릭 해제),
 * 지정 후 반대 팀으로 자동 전환.
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
  const current = target === "A" ? banA : banB;
  const q = query.trim();

  function pick(code: string) {
    const otherBan = target === "A" ? banB : banA;
    if (code === otherBan) return; // 상대 팀이 이미 밴한 영웅은 불가 (중복 밴 방지)
    const set = target === "A" ? setBanA : setBanB;
    if (current === code) {
      set(""); // 같은 영웅 재클릭 → 해제
    } else {
      set(code);
      setTarget(target === "A" ? "B" : "A");
    }
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
                  const onCurrent = h.code === current;
                  const takenByOther = banSide !== null && banSide !== target;
                  return (
                    <button
                      key={h.code}
                      type="button"
                      onClick={() => pick(h.code)}
                      disabled={takenByOther}
                      title={
                        takenByOther ? `${banSide}팀이 이미 밴함` : h.nameKo
                      }
                      className={cn(
                        "group flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all",
                        onCurrent
                          ? "border-primary bg-primary/10"
                          : takenByOther
                            ? "cursor-not-allowed border-destructive/40 bg-destructive/5"
                            : "border-transparent hover:border-border hover:bg-surface-2",
                      )}
                    >
                      <span className="relative">
                        <HeroImage
                          code={h.code}
                          size={60}
                          className={cn(
                            "rounded-lg transition-transform",
                            !takenByOther && "group-hover:scale-105",
                            takenByOther && "opacity-40 grayscale",
                          )}
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
