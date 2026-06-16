"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleIcon, TierImage } from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import { TIER_LABEL_KO } from "@/constants/tiers";
import type { Tier } from "@/domain/types";
import type {
  AdminOption,
  ChannelDetail,
  ChannelMemberRow,
} from "@/lib/admin-console";
import { setMemberDiscordId, updateChannel } from "../../actions";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-surface-2 px-2.5 text-sm text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:dark]";

export function ChannelDetailClient({
  channel,
  admins,
}: {
  channel: ChannelDetail;
  admins: AdminOption[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <ChannelSettings channel={channel} admins={admins} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">멤버</h2>
        {channel.members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-ink-subtle">
            등록된 멤버가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {channel.members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChannelSettings({
  channel,
  admins,
}: {
  channel: ChannelDetail;
  admins: AdminOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(channel.name);
  const [guildId, setGuildId] = useState(channel.discordGuildId ?? "");
  const [channelId, setChannelId] = useState(channel.discordChannelId ?? "");
  const [ownerId, setOwnerId] = useState(channel.ownerAdminId ?? "");

  function onSave() {
    startTransition(async () => {
      const res = await updateChannel({
        channelId: channel.id,
        name: name.trim(),
        discordGuildId: guildId.trim(),
        discordChannelId: channelId.trim(),
        ownerAdminId: ownerId,
      });
      if (res.ok) toast.success("채널 설정을 저장했습니다");
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>채널 설정</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="채널명">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="소유 관리자">
            <select
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
          </Field>
          <Field label="디스코드 서버(길드) ID">
            <Input
              placeholder="123456789012345678"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
            />
          </Field>
          <Field label="디스코드 채널 ID">
            <Input
              placeholder="098765432109876543"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={onSave} disabled={pending}>
            {pending ? "저장 중…" : "설정 저장"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MemberRow({ member }: { member: ChannelMemberRow }) {
  const [pending, startTransition] = useTransition();
  const [discordId, setDiscordId] = useState(member.discordUserId ?? "");

  const dirty = discordId.trim() !== (member.discordUserId ?? "");

  function onSave() {
    startTransition(async () => {
      const res = await setMemberDiscordId({
        memberId: member.id,
        discordUserId: discordId.trim(),
      });
      if (res.ok) {
        toast.success(
          discordId.trim()
            ? "디스코드 ID를 연결했습니다"
            : "디스코드 ID 연결을 해제했습니다",
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-1 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{member.battleTag}</span>
          {member.discordName && (
            <span className="truncate text-xs text-ink-subtle">
              @{member.discordName}
            </span>
          )}
          {member.discordUserId ? (
            <Badge variant="secondary">디코 연결됨</Badge>
          ) : (
            <Badge variant="outline" className="text-ink-subtle">
              디코 미연결
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {member.primaryRole && (
            <Badge variant="secondary" className="gap-1 pl-1.5">
              <RoleIcon role={member.primaryRole} size={14} />주{" "}
              {ROLE_LABEL_KO[member.primaryRole]}
            </Badge>
          )}
          {member.ratings.map((r) => (
            <Badge key={r.role} variant="outline" className="h-6 gap-1 pl-1">
              <TierImage tier={r.tier as Tier} size={16} />
              {ROLE_LABEL_KO[r.role]} {TIER_LABEL_KO[r.tier as Tier]}{" "}
              {r.division}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Input
          placeholder="디스코드 사용자 ID"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          className="w-full lg:w-52"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          {pending ? "저장 중…" : "연결"}
        </Button>
      </div>
    </li>
  );
}
