"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toParticipants } from "@/domain/quick/adapter";
import {
  buildFromSlots,
  candidateToLayout,
  type Layout,
  swapSlots,
} from "@/domain/quick/layout";
import { computeMetrics } from "@/domain/quick/metrics";
import { parseMultipleLines } from "@/domain/quick/parser";
import { rankCandidates } from "@/domain/quick/ranking";
import type { ParsedPlayer } from "@/domain/quick/types";
import { type Candidate, generateCandidates } from "@/domain/team-builder";
import { AlternativesBar } from "./alternatives-bar";
import { InputPanel } from "./input-panel";
import { MetricsBar } from "./metrics-bar";
import { TeamBoard } from "./team-board";
import { useCopyImage } from "./use-copy-image";

interface ResultState {
  candidates: Candidate[];
  playersById: Record<string, ParsedPlayer>;
  selectedIdx: number;
  layout: Layout;
}

export function QuickClient() {
  const [rawText, setRawText] = useState("");
  const [manual, setManual] = useState<ParsedPlayer[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ResultState | null>(null);

  const parsed = useMemo(() => parseMultipleLines(rawText), [rawText]);
  // 붙여넣기 + 수동 입력 병합 (배틀태그 기준 중복 제거)
  const allPlayers = useMemo(() => {
    const seen = new Set<string>();
    const out: ParsedPlayer[] = [];
    for (const p of [...parsed.players, ...manual]) {
      const key = p.battleTag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [parsed, manual]);
  const effective = useMemo(
    () => allPlayers.filter((p) => !excluded.has(p.battleTag)),
    [allPlayers, excluded],
  );
  const participants = effective.slice(0, 10);
  const waitlist = effective.slice(10);

  function toggleExclude(tag: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function addManual(p: ParsedPlayer) {
    const key = p.battleTag.toLowerCase();
    if (allPlayers.some((x) => x.battleTag.toLowerCase() === key)) {
      toast.error("이미 명단에 있는 배틀태그입니다.");
      return;
    }
    setManual((m) => [...m, p]);
    setExcluded((prev) => {
      if (!prev.has(p.battleTag)) return prev;
      const next = new Set(prev);
      next.delete(p.battleTag);
      return next;
    });
    toast.success("명단에 추가했습니다.");
  }

  function handleBuild() {
    if (participants.length < 10) {
      toast.error(`참가자 10명이 필요합니다 (현재 ${participants.length}명)`);
      return;
    }
    const { participants: parts, noMicById } = toParticipants(participants);
    let candidates: Candidate[];
    try {
      candidates = generateCandidates(parts);
    } catch {
      toast.error("편성 계산 중 오류가 발생했습니다.");
      return;
    }
    if (candidates.length === 0) {
      toast.error(
        "티어가 부족해 자동 구성이 안 됩니다. 각자 3역할 티어를 채워 다시 붙여넣어 주세요.",
      );
      return;
    }
    const ranked = rankCandidates(candidates, noMicById);
    const playersById: Record<string, ParsedPlayer> = {};
    for (const p of participants) playersById[`guest:${p.battleTag}`] = p;

    setResult({
      candidates: ranked,
      playersById,
      selectedIdx: 0,
      layout: candidateToLayout(ranked[0]),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      {/* 좌: 입력 + 명단 */}
      <div className="lg:col-span-5">
        <InputPanel
          rawText={rawText}
          onChange={setRawText}
          participants={participants}
          waitlist={waitlist}
          failedLines={parsed.failedLines}
          excludedCount={excluded.size}
          onExclude={toggleExclude}
          onResetExcluded={() => setExcluded(new Set())}
          onAddManual={addManual}
          onBuild={handleBuild}
        />
      </div>

      {/* 우: 편성 결과 */}
      <div className="lg:col-span-7">
        <ResultPanel
          result={result}
          readyCount={participants.length}
          onSwap={(a, b) =>
            setResult((r) =>
              r ? { ...r, layout: swapSlots(r.layout, a, b) } : r,
            )
          }
          onSelectAlt={(idx) =>
            setResult((r) =>
              r
                ? {
                    ...r,
                    selectedIdx: idx,
                    layout: candidateToLayout(r.candidates[idx]),
                  }
                : r,
            )
          }
        />
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  readyCount,
  onSwap,
  onSelectAlt,
}: {
  result: ResultState | null;
  readyCount: number;
  onSwap: (a: string, b: string) => void;
  onSelectAlt: (idx: number) => void;
}) {
  if (!result) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border-2 border-dashed border-border/50 p-8 text-center">
        <p className="text-sm text-ink-subtle">
          {readyCount >= 10
            ? "‘팀 짜기’를 누르면 여기에 편성 결과가 표시됩니다"
            : `참가자 ${10 - readyCount}명을 더 붙여넣으면 팀을 짤 수 있습니다`}
        </p>
      </div>
    );
  }
  return (
    <ResultView result={result} onSwap={onSwap} onSelectAlt={onSelectAlt} />
  );
}

function ResultView({
  result,
  onSwap,
  onSelectAlt,
}: {
  result: ResultState;
  onSwap: (a: string, b: string) => void;
  onSelectAlt: (idx: number) => void;
}) {
  const builtA = useMemo(
    () => buildFromSlots(result.layout.A),
    [result.layout],
  );
  const builtB = useMemo(
    () => buildFromSlots(result.layout.B),
    [result.layout],
  );
  const metrics = useMemo(
    () => computeMetrics(builtA, builtB),
    [builtA, builtB],
  );
  const { boardRef, copyImage, copying } = useCopyImage();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-subtle">
          선수를 드래그해 자리 교체 · 기록되지 않는 일회성 편성입니다
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={copyImage}
          disabled={copying}
        >
          {copying ? "복사 중…" : "이미지 복사"}
        </Button>
      </div>

      <MetricsBar metrics={metrics} />
      <AlternativesBar
        candidates={result.candidates}
        selected={result.selectedIdx}
        onSelect={onSelectAlt}
      />

      <div ref={boardRef}>
        <TeamBoard
          layout={result.layout}
          playersById={result.playersById}
          scoreA={builtA.finalScore}
          scoreB={builtB.finalScore}
          onSwap={onSwap}
        />
      </div>
    </div>
  );
}
