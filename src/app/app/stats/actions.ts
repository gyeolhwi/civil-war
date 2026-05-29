"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "../match/actions";

/**
 * 매치 삭제 (SC-29, F12c): matches 1건 삭제 → teams/team_members CASCADE.
 * 본인 소유 채널 매치만 (RLS owns_channel).
 */
export async function deleteMatch(
  matchId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) return { ok: false, error: "매치 삭제에 실패했습니다" };

  revalidatePath("/app/stats");
  return { ok: true, data: null };
}
