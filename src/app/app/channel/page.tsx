import Link from "next/link";
import { getMyChannel } from "@/lib/channel";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelPage() {
  const channel = await getMyChannel();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const username = user?.email?.split("@")[0] ?? "관리자";

  let memberCount = 0;
  if (channel) {
    const { count } = await supabase
      .from("channel_members")
      .select("member_id", { count: "exact", head: true })
      .eq("channel_id", channel.id);
    memberCount = count ?? 0;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          채널 정보
        </h1>
      </header>

      {!channel ? (
        <p className="rounded-lg border border-dashed border-border/60 px-6 py-10 text-center text-sm text-ink-muted">
          배정된 채널이 없습니다. 슈퍼관리자에게 문의하세요.
        </p>
      ) : (
        <dl className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
          <Row label="채널명" value={channel.name} />
          <Row label="관리자" value={username} />
          <Row label="등록 멤버" value={`${memberCount}명`} />
        </dl>
      )}

      <p className="mt-4 text-xs text-ink-subtle">
        채널명·관리자 정보 수정은 v1.1에서 지원됩니다.
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-ink-subtle">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
