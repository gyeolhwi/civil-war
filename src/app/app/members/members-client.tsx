"use client";

import { useMemo, useState, useTransition } from "react";
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
import { RoleIcon, TierImage } from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { SortSelect } from "@/components/ui/sort-select";
import { ROLE_LABEL_KO, ROLE_ORDER } from "@/constants/heroes";
import { ratingScore, TIER_LABEL_KO } from "@/constants/tiers";
import type { Division, Tier } from "@/domain/types";
import { deleteMember } from "./actions";
import { MemberForm, type MemberView } from "./member-form";

type MemberSort = "joined" | "name" | "score" | "role";

const MEMBER_SORTS: { key: MemberSort; label: string }[] = [
  { key: "joined", label: "가입순" },
  { key: "name", label: "이름순" },
  { key: "score", label: "점수순" },
  { key: "role", label: "역할순" },
];

/** 대표 점수 = 보유 역할 티어 중 최고 환산 점수 (미입력은 맨 뒤로) */
function memberScore(m: MemberView): number {
  if (m.ratings.length === 0) return -1;
  return Math.max(
    ...m.ratings.map((r) =>
      ratingScore(r.tier as Tier, r.division as Division),
    ),
  );
}

/** 주 역할 정렬 순위 (탱→딜→힐, 미지정은 맨 뒤) */
function roleRank(m: MemberView): number {
  return m.primaryRole ? ROLE_ORDER[m.primaryRole] : 99;
}

export function MembersList({ members }: { members: MemberView[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>("joined");

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? members.filter(
          (m) =>
            m.battleTag.toLowerCase().includes(q) ||
            m.discordName?.toLowerCase().includes(q),
        )
      : members;
    if (sort === "joined") return filtered;
    const arr = [...filtered];
    if (sort === "name") {
      arr.sort((a, b) => a.battleTag.localeCompare(b.battleTag, "ko"));
    } else if (sort === "score") {
      arr.sort((a, b) => memberScore(b) - memberScore(a));
    } else {
      arr.sort(
        (a, b) => roleRank(a) - roleRank(b) || memberScore(b) - memberScore(a),
      );
    }
    return arr;
  }, [members, query, sort]);

  if (members.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-ink-subtle">
        아직 등록된 멤버가 없습니다. 우측 상단 "멤버 등록"으로 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="배틀태그·디스코드 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
            {view.length}명
          </span>
          <SortSelect
            value={sort}
            options={MEMBER_SORTS}
            onChange={setSort}
            className="w-36"
          />
        </div>
      </div>

      {view.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-ink-subtle">
          검색 결과가 없습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{m.battleTag}</div>
                  {m.discordName && (
                    <div className="truncate text-xs text-ink-subtle">
                      @{m.discordName}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <MemberForm
                    member={m}
                    trigger={
                      <Button variant="ghost" size="sm">
                        수정
                      </Button>
                    }
                  />
                  <DeleteMemberButton member={m} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {m.primaryRole ? (
                  <Badge variant="secondary" className="gap-1 pl-1.5">
                    <RoleIcon role={m.primaryRole} size={14} />주{" "}
                    {ROLE_LABEL_KO[m.primaryRole]}
                  </Badge>
                ) : null}
                {m.secondaryRole && (
                  <Badge variant="outline" className="gap-1 pl-1.5">
                    <RoleIcon role={m.secondaryRole} size={14} />부{" "}
                    {ROLE_LABEL_KO[m.secondaryRole]}
                  </Badge>
                )}
                {!m.primaryRole && !m.secondaryRole && (
                  <span className="text-xs text-ink-subtle">역할 미지정</span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {m.ratings.length === 0 ? (
                  <span className="text-xs text-ink-subtle">티어 미입력</span>
                ) : (
                  m.ratings.map((r) => (
                    <Badge
                      key={r.role}
                      variant="outline"
                      className="h-6 gap-1 pl-1"
                    >
                      <TierImage tier={r.tier as Tier} size={16} />
                      {ROLE_LABEL_KO[r.role]} {TIER_LABEL_KO[r.tier as Tier]}{" "}
                      {r.division}
                    </Badge>
                  ))
                )}
              </div>

              {(m.heroCodes.length > 0 || m.mapCodes.length > 0) && (
                <div className="flex flex-wrap gap-3 border-t border-border/40 pt-2 text-xs text-ink-subtle">
                  {m.heroCodes.length > 0 && (
                    <span>선호영웅 {m.heroCodes.length}</span>
                  )}
                  {m.mapCodes.length > 0 && (
                    <span>선호맵 {m.mapCodes.length}</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
