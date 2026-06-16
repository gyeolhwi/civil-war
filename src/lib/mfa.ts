import { redirect } from "next/navigation";
import { getMyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 다단계 인증(MFA/TOTP) 공용 헬퍼.
 *
 * AAL(Authenticator Assurance Level) 의미:
 *   · current aal1 / next aal1 → 등록된 2차 인증 없음
 *   · current aal1 / next aal2 → 2차 인증은 등록됐으나 이번 세션에서 미통과 (승급 필요)
 *   · current aal2 / next aal2 → 2차 인증 통과 완료
 */

export interface AalState {
  currentLevel: string | null;
  nextLevel: string | null;
}

export async function getAalState(): Promise<AalState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    currentLevel: data?.currentLevel ?? null,
    nextLevel: data?.nextLevel ?? null,
  };
}

/** 검증 완료된 TOTP factor id (없으면 null). listFactors().totp 는 검증된 것만 반환. */
export async function getVerifiedTotpFactorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.[0]?.id ?? null;
}

/**
 * 슈퍼관리자 + 2차 인증(AAL2) 둘 다 통과해야 통과시키는 페이지 가드.
 * 미통과 시 적절한 경로로 redirect (등록 안 됐으면 등록, 됐으면 코드 입력).
 */
export async function requireSuperWithMfa(): Promise<void> {
  const admin = await getMyAdmin();
  if (!admin) redirect("/login");
  if (!admin.isSuper) redirect("/app");

  const { currentLevel, nextLevel } = await getAalState();
  if (currentLevel !== "aal2") {
    redirect(nextLevel === "aal2" ? "/app/mfa?next=/admin" : "/app/security");
  }
}
