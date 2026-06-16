import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyAdmin } from "@/lib/admin";
import { getAalState, getVerifiedTotpFactorId } from "@/lib/mfa";
import { SecurityClient } from "./security-client";

/**
 * 2단계 인증(TOTP) 설정 — 슈퍼관리자 전용.
 * 등록 안 됐으면 활성화 화면, 됐으면 상태 + 해제 화면.
 */
export default async function SecurityPage() {
  const admin = await getMyAdmin();
  if (!admin) redirect("/login");
  if (!admin.isSuper) redirect("/app");

  const [factorId, aal] = await Promise.all([
    getVerifiedTotpFactorId(),
    getAalState(),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          2단계 인증
        </h1>
        <p className="text-sm text-ink-subtle">
          관제 콘솔(/admin) 접근에 필요합니다. 인증 앱 또는 macOS Apple 암호로
          설정하세요.
        </p>
      </header>

      <SecurityClient
        enabledFactorId={factorId}
        isAal2={aal.currentLevel === "aal2"}
      />
    </main>
  );
}
