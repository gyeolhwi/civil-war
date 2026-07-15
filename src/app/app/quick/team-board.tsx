"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { RoleIcon } from "@/components/ui/game-image";
import type { Layout } from "@/domain/quick/layout";
import type { ParsedPlayer } from "@/domain/quick/types";
import type { Role } from "@/domain/types";
import { PlayerCell } from "./player-slot";

/** 고정 5슬롯 (인덱스=배정 역할, 딜·힐 각 2개라 안정 key 부여) */
const SLOTS: { key: string; role: Role }[] = [
  { key: "tank", role: "tank" },
  { key: "dps-1", role: "dps" },
  { key: "dps-2", role: "dps" },
  { key: "support-1", role: "support" },
  { key: "support-2", role: "support" },
];

/** 맞대결 팀 보드 — 한 행 = 한 포지션 (1팀 좌 · 역할 중앙 · 2팀 우) + 자유 스왑 */
export function TeamBoard({
  layout,
  playersById,
  scoreA,
  scoreB,
  onSwap,
}: {
  layout: Layout;
  playersById: Record<string, ParsedPlayer>;
  scoreA: number;
  scoreB: number;
  onSwap: (a: string, b: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      onSwap(String(active.id), String(over.id));
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        {/* 헤더: 팀명 + 점수 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-lg font-bold text-sky-300">1팀</span>
          <div className="flex items-center gap-4 text-base font-semibold tabular-nums">
            <span className="text-sky-300">{scoreA.toLocaleString()}점</span>
            <span className="text-rose-300">{scoreB.toLocaleString()}점</span>
          </div>
          <span className="text-lg font-bold text-rose-300">2팀</span>
        </div>

        {/* 포지션별 맞대결 행 */}
        <div className="flex flex-col gap-2">
          {SLOTS.map((slot, i) => (
            <div
              key={slot.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-xl border border-border/60 bg-surface-1 px-2 py-2.5 sm:gap-2 sm:px-4 sm:py-3.5"
            >
              <PlayerCell
                slotId={`A-${i}`}
                role={slot.role}
                participant={layout.A[i]}
                player={playersById[layout.A[i].id]}
                side="left"
              />
              <span className="flex size-9 shrink-0 items-center justify-center">
                <RoleIcon role={slot.role} size={18} />
              </span>
              <PlayerCell
                slotId={`B-${i}`}
                role={slot.role}
                participant={layout.B[i]}
                player={playersById[layout.B[i].id]}
                side="right"
              />
            </div>
          ))}
        </div>
      </div>
    </DndContext>
  );
}
