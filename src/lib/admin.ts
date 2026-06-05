import { createClient } from "@/lib/supabase/server";

export interface MyAdmin {
  id: string;
  displayName: string;
  isSuper: boolean;
}

/**
 * 현재 로그인한 관리자 정보 (is_super 포함).
 * admins RLS(본인 행 select 허용)로 본인 행을 읽는다. 미로그인/미등록이면 null.
 */
export async function getMyAdmin(): Promise<MyAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admins")
    .select("display_name, is_super")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    id: user.id,
    displayName: data.display_name || (user.email?.split("@")[0] ?? "관리자"),
    isSuper: data.is_super ?? false,
  };
}
