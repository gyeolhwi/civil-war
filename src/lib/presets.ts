import { createClient } from "@/lib/supabase/server";

export interface MatchPreset {
  id: string;
  code: number;
  label: string | null;
  createdAt: string;
}

/**
 * 채널의 최근 내전 프리셋 목록 (최신순). "내전 시작 → 프리셋 불러오기"에서
 * 사용자가 고를 수 있게 보여준다. RLS(owns_channel)로 본인 채널만 노출된다.
 */
export async function loadPresets(
  channelId: string,
  limit = 10,
): Promise<MatchPreset[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_presets")
    .select("id, code, label, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    code: p.code as number,
    label: (p.label ?? null) as string | null,
    createdAt: p.created_at as string,
  }));
}
