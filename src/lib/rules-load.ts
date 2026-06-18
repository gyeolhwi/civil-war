import "server-only";
import { DEFAULT_RULES_MD } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";

/**
 * 채널의 내전 규칙 본문(마크다운). 채널이 수정한 적 없으면 기본 템플릿.
 * RLS(owns_channel)로 본인 채널 것만 조회된다.
 */
export async function loadChannelRulesBody(channelId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("channel_rules")
    .select("body")
    .eq("channel_id", channelId)
    .maybeSingle();
  const body = (data?.body as string | undefined)?.trim();
  return body ? (data?.body as string) : DEFAULT_RULES_MD;
}
