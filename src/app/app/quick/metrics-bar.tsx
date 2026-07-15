"use client";

import { RoleIcon } from "@/components/ui/game-image";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import type { BalanceMetrics } from "@/domain/quick/metrics";
import type { Role } from "@/domain/types";

/** 밸런스 품질 지표 표시 (B3) — 역할 아이콘 + 명확한 라벨 */
export function MetricsBar({ metrics }: { metrics: BalanceMetrics }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/50 bg-surface-1 px-3 py-2.5 text-xs">
      <div
        className="flex items-center gap-1.5"
        title="두 팀의 총점 차이 (작을수록 균형)"
      >
        <span className="text-ink-subtle">팀 점수차</span>
        <b className="text-sm tabular-nums text-foreground">
          {metrics.totalDiff.toLocaleString()}
        </b>
      </div>

      <span className="h-4 w-px bg-border/60" aria-hidden />

      <div className="flex items-center gap-2">
        <span className="text-ink-subtle">역할 격차</span>
        {(["tank", "dps", "support"] as Role[]).map((r) => (
          <RoleDiff key={r} role={r} value={metrics.roleDiff[r]} />
        ))}
      </div>

      <span className="h-4 w-px bg-border/60" aria-hidden />

      <div
        className="flex items-center gap-1.5"
        title="각 팀 내부 실력 편차 (작을수록 팀 안이 고름)"
      >
        <span className="text-ink-subtle">팀 내 편차</span>
        <span className="tabular-nums">
          <span className="text-sky-300">{metrics.stdDev[0]}</span>
          <span className="text-ink-subtle"> / </span>
          <span className="text-rose-300">{metrics.stdDev[1]}</span>
        </span>
      </div>
    </div>
  );
}

function RoleDiff({ role, value }: { role: Role; value: number }) {
  return (
    <span
      className="flex items-center gap-1 tabular-nums text-ink-muted"
      title={`${ROLE_LABEL_KO[role]} 점수 격차`}
    >
      <RoleIcon role={role} size={12} />
      {value.toLocaleString()}
    </span>
  );
}
