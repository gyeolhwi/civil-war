"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 아이디 로그인 — username을 내부 이메일로 변환 후 인증 (docs/requirements.md §2.1) */
export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=empty");
  }

  const domain =
    process.env.NEXT_PUBLIC_INTERNAL_EMAIL_DOMAIN ?? "civilwar.local";
  // 입력에 @가 있으면 실제 이메일로 그대로, 없으면 아이디 → 내부 이메일 변환
  const email = username.includes("@") ? username : `${username}@${domain}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const code = error.message.toLowerCase().includes("not confirmed")
      ? "unconfirmed"
      : "invalid";
    redirect(`/login?error=${code}`);
  }

  // 2단계 인증이 등록된 계정(슈퍼관리자)이면 비번 통과 후 코드 입력 단계로.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    redirect("/app/mfa");
  }

  redirect("/app");
}
