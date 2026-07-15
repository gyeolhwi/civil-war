"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { MicOff, Star } from "lucide-react";
import { TierImage } from "@/components/ui/game-image";
import { TIER_LABEL_KO } from "@/constants/tiers";
import type { ParsedPlayer } from "@/domain/quick/types";
import type { Participant } from "@/domain/team-builder";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/utils";

/**
 * 맞대결 레이아웃의 한 팀원 셀. 드래그로 자리 교체(자유 스왑).
 * side="left"는 중앙을 향해 우측 정렬, "right"는 좌측 정렬로 미러링.
 */
export function PlayerCell({
  slotId,
  role,
  participant,
  player,
  side,
}: {
  slotId: string;
  role: Role;
  participant: Participant;
  player: ParsedPlayer | undefined;
  side: "left" | "right";
}) {
  const draggable = useDraggable({ id: slotId });
  const droppable = useDroppable({ id: slotId });
  const rank = player?.ranks[role];
  const name = participant.battleTag.split("#")[0];

  const setRefs = (el: HTMLElement | null) => {
    draggable.setNodeRef(el);
    droppable.setNodeRef(el);
  };

  const nameEl = (
    <span className="truncate text-sm font-semibold text-foreground sm:text-base">
      {name}
    </span>
  );
  const star = rank?.preferred ? (
    <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
  ) : null;
  const mic = player?.noMic ? (
    <MicOff className="size-3.5 shrink-0 text-rose-400" />
  ) : null;
  const tierEl = rank ? (
    <span className="flex shrink-0 items-center gap-1">
      <TierImage tier={rank.tier} size={26} />
      <span className="text-sm tabular-nums text-ink-muted">
        {TIER_LABEL_KO[rank.tier][0]}
        {rank.division}
      </span>
    </span>
  ) : (
    <span
      className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-subtle"
      title="이 역할 티어 없음 (추정 배정)"
    >
      추정
    </span>
  );

  return (
    <div
      ref={setRefs}
      {...draggable.listeners}
      {...draggable.attributes}
      className={cn(
        "flex min-w-0 cursor-grab touch-none items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2 active:cursor-grabbing",
        side === "left"
          ? "flex-row justify-end"
          : "flex-row-reverse justify-end",
        draggable.isDragging && "opacity-40",
        droppable.isOver && "bg-surface-2 ring-2 ring-primary",
      )}
    >
      {nameEl}
      {star}
      {mic}
      {tierEl}
    </div>
  );
}
