import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannelDetail, listAdminOptions } from "@/lib/admin-console";
import { listGuildVoiceChannels } from "@/lib/discord/rest";
import { requireSuperWithMfa } from "@/lib/mfa";
import { ChannelDetailClient } from "./channel-detail-client";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperWithMfa();

  const { id } = await params;
  const [channel, admins] = await Promise.all([
    getChannelDetail(id),
    listAdminOptions(),
  ]);
  if (!channel) notFound();

  // 그 서버의 음성채널 목록을 봇으로 가져와 드롭다운에 제공(길드 미연결·실패 시 빈 배열 → 수동 입력 폴백).
  const voiceChannels = channel.discordGuildId
    ? await listGuildVoiceChannels(channel.discordGuildId)
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <Link
          href="/admin"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 채널 관제
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {channel.name}
        </h1>
        <p className="text-sm text-ink-subtle">
          멤버 {channel.members.length}명
        </p>
      </header>

      <ChannelDetailClient
        channel={channel}
        admins={admins}
        voiceChannels={voiceChannels}
      />
    </main>
  );
}
