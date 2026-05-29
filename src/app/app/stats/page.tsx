import Link from "next/link";
import { getMyChannel } from "@/lib/channel";
import { loadMatches } from "@/lib/matches";
import { StatsClient } from "./stats-client";

export default async function StatsPage() {
  const channel = await getMyChannel();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          전적·통계
        </h1>
      </header>

      {!channel ? (
        <p className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-ink-muted">
          배정된 채널이 없습니다. 슈퍼관리자에게 문의하세요.
        </p>
      ) : (
        <StatsClient matches={await loadMatches(channel.id)} />
      )}
    </main>
  );
}
