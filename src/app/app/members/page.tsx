import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Role } from "@/domain/types";
import { getMyChannel } from "@/lib/channel";
import { createClient } from "@/lib/supabase/server";
import { MemberForm, type MemberView } from "./member-form";
import { MembersList } from "./members-client";

export default async function MembersPage() {
  const channel = await getMyChannel();

  if (!channel) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <PageHeader />
        <div className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center">
          <p className="text-sm text-ink-muted">
            배정된 채널이 없습니다. 슈퍼관리자가 채널을 생성해야 멤버를 등록할
            수 있습니다.
          </p>
        </div>
      </main>
    );
  }

  const members = await loadMembers(channel.id);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <PageHeader
        channelName={channel.name}
        action={<MemberForm trigger={<Button size="sm">멤버 등록</Button>} />}
      />
      <MembersList members={members} />
    </main>
  );
}

function PageHeader({
  channelName,
  action,
}: {
  channelName?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          멤버 관리
        </h1>
        {channelName && (
          <p className="text-sm text-ink-subtle">{channelName}</p>
        )}
      </div>
      {action}
    </header>
  );
}

async function loadMembers(channelId: string): Promise<MemberView[]> {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("channel_members")
    .select("member_id, primary_role, secondary_role, joined_at")
    .eq("channel_id", channelId)
    .order("joined_at", { ascending: true });

  if (!links || links.length === 0) return [];

  const memberIds = links.map((l) => l.member_id);

  const [
    { data: members },
    { data: ratings },
    { data: heroes },
    { data: maps },
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id, battle_tag, discord_name")
      .in("id", memberIds),
    supabase
      .from("member_role_ratings")
      .select("member_id, role, tier, division")
      .eq("channel_id", channelId),
    supabase
      .from("member_hero_preferences")
      .select("member_id, hero_code")
      .eq("channel_id", channelId),
    supabase
      .from("member_map_preferences")
      .select("member_id, map_code")
      .eq("channel_id", channelId),
  ]);

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));

  return links.map((link) => {
    const m = memberById.get(link.member_id);
    return {
      id: link.member_id,
      battleTag: m?.battle_tag ?? "(알 수 없음)",
      discordName: m?.discord_name ?? null,
      primaryRole: (link.primary_role as Role | null) ?? null,
      secondaryRole: (link.secondary_role as Role | null) ?? null,
      ratings: (ratings ?? [])
        .filter((r) => r.member_id === link.member_id)
        .map((r) => ({
          role: r.role as Role,
          tier: r.tier as string,
          division: r.division as number,
        })),
      heroCodes: (heroes ?? [])
        .filter((h) => h.member_id === link.member_id)
        .map((h) => h.hero_code as string),
      mapCodes: (maps ?? [])
        .filter((mp) => mp.member_id === link.member_id)
        .map((mp) => mp.map_code as string),
    } satisfies MemberView;
  });
}
