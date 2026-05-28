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
  const email = `${username}@${domain}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid");
  }

  redirect("/app");
}
