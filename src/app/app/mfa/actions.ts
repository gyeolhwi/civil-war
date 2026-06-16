"use server";

import { getVerifiedTotpFactorId } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

/** 로그인 후 2단계 인증 코드 검증 — 통과 시 세션이 AAL2 로 승급된다. */
export async function verifyStepUp(code: string): Promise<ActionResult> {
  const factorId = await getVerifiedTotpFactorId();
  if (!factorId) return { ok: false, error: "등록된 2단계 인증이 없습니다" };

  const supabase = await createClient();
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chErr || !challenge) {
    return { ok: false, error: "인증 확인에 실패했습니다. 다시 시도하세요." };
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) {
    return { ok: false, error: "코드가 올바르지 않습니다. 다시 확인하세요." };
  }
  return { ok: true };
}
