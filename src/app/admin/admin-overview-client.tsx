"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminOption, ChannelOverview } from "@/lib/admin-console";
import { createChannel } from "./actions";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-surface-2 px-2.5 text-sm text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:dark]";

export function AdminOverview({
  channels,
  admins,
}: {
  channels: ChannelOverview[];
  admins: AdminOption[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-subtle">
          전체 채널 {channels.length}개
        </span>
        <ChannelAddDialog admins={admins} />
      </div>

      {channels.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-12 text-center text-sm text-ink-subtle">
          연결된 채널이 없습니다. 우측 상단 "채널 추가"로 시작하세요.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/channels/${c.id}`} className="block">
                <Card className="h-full transition-colors hover:ring-foreground/20">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="truncate">{c.name}</span>
                      <ConnectionBadge connected={!!c.discordGuildId} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex gap-4 text-sm">
                      <Stat label="멤버" value={`${c.memberCount}명`} />
                      <Stat label="내전" value={`${c.matchCount}회`} />
                    </div>
                    <div className="text-xs text-ink-subtle">
                      관리자: {c.ownerName ?? "미지정"}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-ink-subtle">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge variant="secondary" className="shrink-0">
      ● 연결됨
    </Badge>
  ) : (
    <Badge variant="outline" className="shrink-0 text-ink-subtle">
      ○ 미연결
    </Badge>
  );
}

function ChannelAddDialog({ admins }: { admins: AdminOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [ownerId, setOwnerId] = useState("");

  function reset() {
    setName("");
    setGuildId("");
    setChannelId("");
    setOwnerId("");
  }

  function onSubmit() {
    startTransition(async () => {
      const res = await createChannel({
        name: name.trim(),
        discordGuildId: guildId.trim(),
        discordChannelId: channelId.trim(),
        ownerAdminId: ownerId,
      });
      if (res.ok) {
        toast.success("채널을 추가했습니다");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm">채널 추가</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>채널 추가</DialogTitle>
          <DialogDescription>
            디스코드 서버(길드)·채널 ID는 나중에 연결해도 됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ch-name">채널명</Label>
            <Input
              id="ch-name"
              placeholder="OW 내전방"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ch-guild">디스코드 서버(길드) ID (선택)</Label>
            <Input
              id="ch-guild"
              placeholder="123456789012345678"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ch-channel">디스코드 채널 ID (선택)</Label>
            <Input
              id="ch-channel"
              placeholder="098765432109876543"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ch-owner">소유 관리자 (선택)</Label>
            <select
              id="ch-owner"
              className={selectClass}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">미지정</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? "추가 중…" : "추가"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
