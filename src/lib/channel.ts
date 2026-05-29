import { createClient } from "@/lib/supabase/server";

export interface MyChannel {
  id: string;
  name: string;
}

/**
 * 현재 로그인한 관리자가 소유한 채널을 반환 (v1은 1:1 운영).
 * 채널이 없으면 null — 호출부에서 "배정된 채널 없음" 안내 (SC-03 대안).
 * RLS(owns_channel)가 본인 소유 채널만 노출하므로 별도 필터 불필요.
 */
export async function getMyChannel(): Promise<MyChannel | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channels")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
