import type { Candidate } from "@/domain/team-builder";
import { cn } from "@/lib/utils";

/** 후보 고유 서명 — 분할(teamA 멤버 집합)이 후보를 유일하게 식별 */
function signature(c: Candidate): string {
  return c.teamA.members
    .map((m) => m.participant.id)
    .sort()
    .join(",");
}

/**
 * 상위 대안 후보 (B2) — 세그먼트 컨트롤. 위=번호, 아래=점수차.
 * 클릭하면 그 조합으로 교체.
 */
export function AlternativesBar({
  candidates,
  selected,
  onSelect,
}: {
  candidates: Candidate[];
  selected: number;
  onSelect: (idx: number) => void;
}) {
  if (candidates.length <= 1) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-subtle">
        대안 조합 <span className="text-ink-muted">· 점수차 작을수록 균형</span>
      </span>
      <div className="flex overflow-hidden rounded-lg border border-border/60">
        {candidates.map((c, i) => {
          const active = i === selected;
          return (
            <button
              key={signature(c)}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors",
                i > 0 && "border-l border-border/60",
                active
                  ? "bg-primary/15 text-foreground"
                  : "text-ink-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <span className="text-xs text-ink-subtle">{i + 1}</span>
              <span className="text-base font-semibold tabular-nums">
                {c.diff.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
