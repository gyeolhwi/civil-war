"use client";

import { MessageSquareText, MicOff, Star, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleIcon, TierImage } from "@/components/ui/game-image";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import type { ParsedPlayer } from "@/domain/quick/types";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/utils";
import { ManualInput } from "./manual-input";

const ROLES: Role[] = ["tank", "dps", "support"];

const PLACEHOLDER = `예시 (한 줄에 한 명, 탱/딜/힐 순):
선수1#1001 다5/다1/다5
선수2#1002 다3/마4/다4
재봉이#31207 그5!/마1!/마4     ← ! 선호 포지션
학살#38848 다3/마4/다4 X        ← X 마이크 없음`;

type Mode = "paste" | "manual";

export function InputPanel({
  rawText,
  onChange,
  participants,
  waitlist,
  failedLines,
  excludedCount,
  onExclude,
  onResetExcluded,
  onAddManual,
  onBuild,
}: {
  rawText: string;
  onChange: (v: string) => void;
  participants: ParsedPlayer[];
  waitlist: ParsedPlayer[];
  failedLines: string[];
  excludedCount: number;
  onExclude: (tag: string) => void;
  onResetExcluded: () => void;
  onAddManual: (p: ParsedPlayer) => void;
  onBuild: () => void;
}) {
  const [mode, setMode] = useState<Mode>("paste");
  const hasAny = participants.length > 0 || waitlist.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* 탭 */}
      <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
        <TabButton
          active={mode === "paste"}
          onClick={() => setMode("paste")}
          icon={<MessageSquareText className="size-4" />}
        >
          채팅 붙여넣기
        </TabButton>
        <TabButton
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon={<UserPlus className="size-4" />}
        >
          수동 입력
        </TabButton>
      </div>

      {/* 탭 내용 */}
      {mode === "paste" ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={rawText}
            onChange={(e) => onChange(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={7}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <p className="flex flex-wrap items-center gap-1 text-xs text-ink-subtle">
            <Star className="size-3 fill-amber-400 text-amber-400" /> 선호 ·
            <span className="font-semibold text-rose-400">?</span> 비선호 ·
            <MicOff className="size-3 text-rose-400" /> 마이크 없음
          </p>
          {failedLines.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="mb-1 text-xs font-medium text-amber-400">
                못 읽은 줄 ({failedLines.length}) — 티어를 확인해 다시 붙여넣어
                주세요
              </p>
              <p className="text-xs text-ink-subtle">
                {failedLines.join(", ")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <ManualInput onAdd={onAddManual} />
      )}

      {/* 명단 */}
      {hasAny && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-ink-muted">
              참가 {participants.length}/10
            </span>
            {excludedCount > 0 && (
              <button
                type="button"
                onClick={onResetExcluded}
                className="text-xs text-ink-subtle transition-colors hover:text-foreground"
              >
                제외 {excludedCount}명 되돌리기
              </button>
            )}
          </div>

          <ul className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-lg border border-border/60 bg-surface-1">
            {participants.map((p) => (
              <PreviewRow key={p.battleTag} player={p} onExclude={onExclude} />
            ))}
          </ul>

          {waitlist.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="px-1 text-xs font-medium text-amber-400">
                대기 {waitlist.length}명 · 11번째부터 (참가자 제거 시 자동 승격)
              </span>
              <ul className="flex flex-col divide-y divide-border/30 overflow-hidden rounded-lg border border-dashed border-border/50 opacity-70">
                {waitlist.map((p) => (
                  <PreviewRow
                    key={p.battleTag}
                    player={p}
                    onExclude={onExclude}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 팀 짜기 */}
      <Button
        onClick={onBuild}
        disabled={participants.length < 10}
        className="w-full"
      >
        팀 짜기 ({participants.length}/10)
      </Button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-ink-subtle hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function PreviewRow({
  player,
  onExclude,
}: {
  player: ParsedPlayer;
  onExclude: (tag: string) => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <div className="flex items-center gap-1.5">
        {ROLES.map((role) => {
          const r = player.ranks[role];
          return (
            <span
              key={role}
              className="flex items-center gap-0.5"
              title={ROLE_LABEL_KO[role]}
            >
              <RoleIcon
                role={role}
                size={13}
                className={cn(!r && "opacity-25")}
              />
              {r ? (
                <>
                  <TierImage tier={r.tier} size={16} />
                  <span className="text-xs tabular-nums text-ink-muted">
                    {r.division}
                  </span>
                  {r.preferred && (
                    <Star className="size-2.5 fill-amber-400 text-amber-400" />
                  )}
                </>
              ) : (
                <span className="text-xs text-ink-subtle">—</span>
              )}
            </span>
          );
        })}
      </div>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {player.battleTag}
      </span>
      {player.noMic && <MicOff className="size-3.5 shrink-0 text-rose-400" />}
      <button
        type="button"
        onClick={() => onExclude(player.battleTag)}
        title="제외"
        className="shrink-0 text-ink-subtle transition-colors hover:text-rose-400"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
