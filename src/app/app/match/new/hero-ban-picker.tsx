"use client";

import { useState } from "react";
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
 * 영웅 밴 카드 피커. A/B 밴 슬롯 토글 + 영웅 카드 그리드(초상).
 * 카드 클릭 → 현재 대상 팀 밴 지정(같은 영웅 재클릭 시 해제), 지정 후 반대 팀으로 자동 전환.
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

  function pick(code: string) {
    const set = target === "A" ? setBanA : setBanB;
    if (current === code) {
      set(""); // 같은 영웅 재클릭 → 해제
    } else {
      set(code);
      setTarget(target === "A" ? "B" : "A"); // 지정 후 반대 팀으로
    }
  }

  const q = query.trim();

  return (
    <div className="flex flex-col gap-3">
      {/* A/B 밴 슬롯 */}
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((side) => {
          const code = side === "A" ? banA : banB;
          const hero = code ? HERO_BY_CODE[code] : null;
          const active = target === side;
          return (
            <button
              key={side}
              type="button"
              onClick={() => setTarget(side)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:bg-surface-2",
              )}
            >
              {hero ? (
                <HeroImage code={code} size={32} />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-ink-subtle">
                  🚫
                </span>
              )}
              <span className="flex flex-col">
                <span className="text-xs text-ink-subtle">{side}팀 밴</span>
                <span className="text-sm font-medium">
                  {hero?.nameKo ?? "밴 없음"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-subtle">
        <span className="font-medium text-foreground">{target}팀</span> 밴 지정
        중 — 영웅 카드를 누르세요 (다시 누르면 해제)
      </p>

      <Input
        placeholder="영웅 이름 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* 영웅 카드 그리드 (역할별) */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
        {ROLES.map((role) => {
          const list = HEROES_BY_ROLE[role].filter(
            (h) => !q || h.nameKo.includes(q),
          );
          if (list.length === 0) return null;
          return (
            <div key={role} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-subtle">
                {ROLE_LABEL_KO[role]}
              </span>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {list.map((h) => {
                  const selected = h.code === banA || h.code === banB;
                  const onCurrent = h.code === current;
                  return (
                    <button
                      key={h.code}
                      type="button"
                      onClick={() => pick(h.code)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors",
                        onCurrent
                          ? "border-primary bg-primary/10"
                          : selected
                            ? "border-destructive/50 bg-destructive/10"
                            : "border-transparent hover:bg-surface-2",
                      )}
                      title={h.nameKo}
                    >
                      <HeroImage code={h.code} size={40} />
                      <span className="w-full truncate text-center text-[11px]">
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
