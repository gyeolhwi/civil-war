import Link from "next/link";
import { RulesModal } from "@/components/rules-modal";
import { getMyChannel } from "@/lib/channel";
import { loadParticipants } from "@/lib/participants";
import { loadPresets } from "@/lib/presets";
import { loadChannelRulesBody } from "@/lib/rules-load";
import { MatchWizard } from "./match-wizard";

export default async function NewMatchPage() {
  const channel = await getMyChannel();

  if (!channel) {
    return (
      <Shell>
        <p className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-ink-muted">
          배정된 채널이 없습니다. 슈퍼관리자에게 문의하세요.
        </p>
      </Shell>
    );
  }

  const [participants, presets, rulesBody] = await Promise.all([
    loadParticipants(channel.id),
    loadPresets(channel.id),
    loadChannelRulesBody(channel.id),
  ]);

  if (participants.length < 10) {
    return (
      <Shell>
        <p className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-ink-muted">
          내전을 시작하려면 멤버가 최소 10명 필요합니다. (현재{" "}
          {participants.length}명) ·{" "}
          <Link href="/app/members" className="underline hover:text-foreground">
            멤버 관리
          </Link>
          에서 추가하세요.
        </p>
      </Shell>
    );
  }

  return (
    <Shell action={<RulesModal body={rulesBody} />}>
      <MatchWizard participants={participants} presets={presets} />
    </Shell>
  );
}

function Shell({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            내전 시작
          </h1>
          {action}
        </div>
      </header>
      {children}
    </main>
  );
}
