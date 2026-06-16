import Link from "next/link";
import { listAdminOptions, listChannelsOverview } from "@/lib/admin-console";
import { requireSuperWithMfa } from "@/lib/mfa";
import { AdminOverview } from "./admin-overview-client";

/**
 * 슈퍼관리자 관제 콘솔 — 전체 채널 개요.
 * 슈퍼관리자 + 2단계 인증(AAL2) 통과 필요. admin.<도메인> 서브도메인이 이 경로로 매핑된다.
 */
export default async function AdminConsolePage() {
  await requireSuperWithMfa();

  const [channels, admins] = await Promise.all([
    listChannelsOverview(),
    listAdminOptions(),
  ]);

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
          채널 관제
        </h1>
        <p className="text-sm text-ink-subtle">
          전체 채널의 멤버 구성과 디스코드 연결 상태를 한눈에 관리합니다.
        </p>
      </header>

      <AdminOverview channels={channels} admins={admins} />
    </main>
  );
}
