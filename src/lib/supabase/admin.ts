import { createClient } from "@supabase/supabase-js";

/**
 * service-role Supabase 클라이언트 (RLS 우회).
 *
 * ⚠️ 서버 전용 — 반드시 `"use server"` 액션 안에서만 import 할 것.
 * (서버 액션은 클라이언트 번들에 포함되지 않으므로 service-role 키가 노출되지 않는다)
 * 공개 개인전적 검색처럼 로그인 세션 없이 읽어야 하는 경로에서만 사용하고,
 * 모든 쿼리는 호출부에서 member_id / channel_id 로 스코프한다.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
