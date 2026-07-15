import Link from "next/link";
import { QuickClient } from "./quick-client";

export const metadata = { title: "빠른편성" };

export default function QuickMatchPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          빠른편성{" "}
          <span className="text-sm font-normal text-ink-subtle">
            (OWKR형식 · 기록 안 됨)
          </span>
        </h1>
        <p className="text-sm text-ink-subtle">
          디스코드 티어 명단을 붙여넣으면 즉석에서 팀을 자동 편성합니다. 멤버
          DB·전적과 무관한 일회성 도구입니다.
        </p>
      </header>
      <QuickClient />
    </main>
  );
}
