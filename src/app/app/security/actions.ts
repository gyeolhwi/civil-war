"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * TOTP 등록 시작 — 미검증 factor 를 만들고 QR·설정키를 돌려준다.
 * 사용자가 인증 앱(또는 macOS Apple 암호)에 추가한 뒤 verifyEnrollment 로 활성화.
 */
export async function enrollTotp(): Promise<
  | { ok: true; factorId: string; qrCode: string; secret: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
  });
  if (error || !data) {
    return { ok: false, error: "2단계 인증 등록을 시작하지 못했습니다" };
  }
  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret ?? null,
  };
}

/** 등록 마무리 — 인증 앱 6자리 코드로 factor 를 검증·활성화한다. */
export async function verifyEnrollment(
  factorId: string,
  code: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (chErr || !challenge) {
    return { ok: false, error: "코드 확인에 실패했습니다. 다시 시도하세요." };
  }
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) {
    return { ok: false, error: "코드가 올바르지 않습니다. 다시 확인하세요." };
  }
  revalidatePath("/app/security");
  return { ok: true };
}

/** 2단계 인증 해제 (Supabase 가 AAL2 세션을 요구 — 미통과 시 에러). */
export async function unenrollTotp(factorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return {
      ok: false,
      error: "해제에 실패했습니다. 2단계 인증을 통과한 뒤 다시 시도하세요.",
    };
  }
  revalidatePath("/app/security");
  return { ok: true };
}
