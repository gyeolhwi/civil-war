"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RoleIcon } from "@/components/ui/game-image";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import { TIER_LABEL_KO, TIER_ORDER } from "@/constants/tiers";
import type { ParsedPlayer, ParsedRank } from "@/domain/quick/types";
import type { Division, Role, Tier } from "@/domain/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["tank", "dps", "support"];
const DIVISIONS: Division[] = [1, 2, 3, 4, 5];

const selectClass =
  "h-8 rounded-lg border border-input bg-surface-2 px-2 text-sm text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 [color-scheme:dark]";

interface RoleRow {
  enabled: boolean;
  tier: Tier;
  division: Division;
  preferred: boolean;
}

function initialRows(): Record<Role, RoleRow> {
  return {
    tank: { enabled: true, tier: "diamond", division: 3, preferred: false },
    dps: { enabled: true, tier: "diamond", division: 3, preferred: false },
    support: {
      enabled: true,
      tier: "platinum",
      division: 3,
      preferred: false,
    },
  };
}

/** 수동 입력 — 배틀태그 + 역할별 티어 드롭다운으로 한 명씩 추가 */
export function ManualInput({ onAdd }: { onAdd: (p: ParsedPlayer) => void }) {
  const [battleTag, setBattleTag] = useState("");
  const [rows, setRows] = useState<Record<Role, RoleRow>>(initialRows);
  const [noMic, setNoMic] = useState(false);

  function update(role: Role, patch: Partial<RoleRow>) {
    setRows((r) => ({ ...r, [role]: { ...r[role], ...patch } }));
  }

  function submit() {
    const tag = battleTag.trim();
    if (!/^.+#\d{3,}$/.test(tag)) {
      toast.error("배틀태그 형식을 확인하세요 (예: 닉네임#1234)");
      return;
    }
    const ranks: Partial<Record<Role, ParsedRank>> = {};
    for (const role of ROLES) {
      const row = rows[role];
      if (!row.enabled) continue;
      ranks[role] = {
        tier: row.tier,
        division: row.division,
        preferred: row.preferred,
        avoided: false,
      };
    }
    if (Object.keys(ranks).length === 0) {
      toast.error("최소 한 역할의 티어를 선택하세요");
      return;
    }
    onAdd({ battleTag: tag, ranks, noMic });
    setBattleTag("");
    setRows(initialRows());
    setNoMic(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={battleTag}
        onChange={(e) => setBattleTag(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="배틀태그 (닉네임#1234)"
        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />

      <div className="flex flex-col gap-2">
        {ROLES.map((role) => {
          const row = rows[role];
          return (
            <div key={role} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => update(role, { enabled: !row.enabled })}
                className={cn(
                  "flex w-[72px] shrink-0 items-center justify-center gap-1 rounded-md border py-1.5 text-xs transition-colors",
                  row.enabled
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 text-ink-subtle hover:text-foreground",
                )}
              >
                <RoleIcon role={role} size={13} />
                {ROLE_LABEL_KO[role]}
              </button>
              <select
                value={row.tier}
                disabled={!row.enabled}
                onChange={(e) => update(role, { tier: e.target.value as Tier })}
                className={cn(selectClass, "flex-1")}
              >
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL_KO[t]}
                  </option>
                ))}
              </select>
              <select
                value={String(row.division)}
                disabled={!row.enabled}
                onChange={(e) =>
                  update(role, { division: Number(e.target.value) as Division })
                }
                className={selectClass}
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!row.enabled}
                onClick={() => update(role, { preferred: !row.preferred })}
                title="선호 포지션"
                className="shrink-0 p-1 disabled:opacity-30"
              >
                <Star
                  className={cn(
                    "size-4",
                    row.preferred
                      ? "fill-amber-400 text-amber-400"
                      : "text-ink-subtle",
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={noMic}
            onChange={(e) => setNoMic(e.target.checked)}
            className="size-3.5 accent-rose-400"
          />
          마이크 없음
        </label>
        <Button size="sm" onClick={submit} disabled={!battleTag.trim()}>
          추가
        </Button>
      </div>
    </div>
  );
}
