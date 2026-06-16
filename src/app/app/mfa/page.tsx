import { redirect } from "next/navigation";
import { getAalState, getVerifiedTotpFactorId } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";
import { MfaStepUp } from "./mfa-client";

/** 내부 경로만 허용 (오픈 리다이렉트 방지). */
function safeNext(next?: string): string {
  if (next?.startsWith("/") && !next.startsWith("//")) return next;
  return "/app";
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { next } = await searchParams;
  const target = safeNext(next);

  const aal = await getAalState();
  if (aal.currentLevel === "aal2") redirect(target);

  // 검증된 factor 가 없으면(미등록) 먼저 등록 화면으로
  const factorId = await getVerifiedTotpFactorId();
  if (!factorId) redirect("/app/security");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 items-center justify-center px-6 py-12">
      <MfaStepUp next={target} />
    </main>
  );
}
