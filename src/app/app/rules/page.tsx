import { getMyChannel } from "@/lib/channel";
import { DEFAULT_RULES_MD } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";
import { RulesClient } from "./rules-client";

/** 내전 규칙 보기·편집 (채널 관리자 전용). */
export default async function RulesPage() {
  const channel = await getMyChannel();
  if (!channel) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
          배정된 채널이 없습니다.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("channel_rules")
    .select("body")
    .eq("channel_id", channel.id)
    .maybeSingle();
  const custom = (data?.body as string | undefined)?.trim() || "";

  return (
    <RulesClient
      initialBody={custom || DEFAULT_RULES_MD}
      isCustom={Boolean(custom)}
    />
  );
}
