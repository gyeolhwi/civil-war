"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import { TIER_LABEL_KO } from "@/constants/tiers";
import type { Tier } from "@/domain/types";
import { deleteMember } from "./actions";
import { MemberForm, type MemberView } from "./member-form";

export function MembersList({ members }: { members: MemberView[] }) {
  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-ink-subtle">
        아직 등록된 멤버가 없습니다. 우측 상단 "멤버 등록"으로 추가하세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {members.map((m) => (
        <li
          key={m.id}
          className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-medium">{m.battleTag}</span>
              {m.discordName && (
                <span className="text-xs text-ink-subtle">
                  @{m.discordName}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {m.primaryRole && (
                <Badge variant="secondary">
                  주 {ROLE_LABEL_KO[m.primaryRole]}
                </Badge>
              )}
              {m.secondaryRole && (
                <Badge variant="outline">
                  부 {ROLE_LABEL_KO[m.secondaryRole]}
                </Badge>
              )}
              {m.ratings.length === 0 && (
                <span className="text-xs text-ink-subtle">티어 미입력</span>
              )}
              {m.ratings.map((r) => (
                <Badge key={r.role} variant="outline">
                  {ROLE_LABEL_KO[r.role]} {TIER_LABEL_KO[r.tier as Tier]}{" "}
                  {r.division}
                </Badge>
              ))}
              {m.heroCodes.length > 0 && (
                <span className="text-xs text-ink-subtle">
                  · 선호영웅 {m.heroCodes.length}
                </span>
              )}
              {m.mapCodes.length > 0 && (
                <span className="text-xs text-ink-subtle">
                  · 선호맵 {m.mapCodes.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <MemberForm
              member={m}
              trigger={
                <Button variant="secondary" size="sm">
                  수정
                </Button>
              }
            />
            <DeleteMemberButton member={m} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DeleteMemberButton({ member }: { member: MemberView }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteMember(member.id);
      if (res.ok) {
        toast.success("멤버를 채널에서 제외했습니다");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>멤버 삭제</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {member.battleTag}
            </span>
            를 이 채널에서 제외합니다. 과거 매치 기록은 보존됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
