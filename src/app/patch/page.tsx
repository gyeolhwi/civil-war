import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

// 패치노트 공개 게시판 (로그인 없이 열람). 글은 patch_posts 테이블(공개 read RLS).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "패치노트 — 내전",
  description: "오버워치 공식 패치 소식 + 내전 웹·봇 업데이트",
};

interface Post {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

/** `**굵게**` 와 `[라벨](url)` 만 가볍게 렌더. (관리자 작성 본문 신뢰) */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex 토큰화 표준 패턴
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <a
          key={k++}
          href={m[2]}
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
        >
          {m[1]}
        </a>,
      );
    } else {
      nodes.push(<strong key={k++}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default async function PatchBoardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patch_posts")
    .select("id, title, body, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });
  const posts = (data ?? []) as Post[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">📰 패치노트</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        오버워치 공식 패치 소식 + 내전 웹·봇 업데이트
      </p>

      {posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          아직 등록된 패치노트가 없어요.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <header className="mb-3">
                <h2 className="text-lg font-semibold">{post.title}</h2>
                <time className="text-xs text-muted-foreground">
                  {post.created_at.slice(0, 10)}
                </time>
              </header>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {renderInline(post.body)}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
