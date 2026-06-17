import type { ReactNode } from "react";
import { getAllPatchPosts } from "@/lib/patch-notes/load";

// 패치노트 공개 게시판 (로그인 없이 열람). 글은 content/patch-notes/*.md.
// 파일 시스템을 읽으므로 정적 생성하지 않고 요청 시 렌더.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "패치노트 — 내전",
  description: "오버워치 공식 패치 소식 + 내전 웹·봇 업데이트",
};

/** `**굵게**` 와 `[라벨](url)` 만 가볍게 렌더. (관리자 작성 마크다운 신뢰) */
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

export default function PatchBoardPage() {
  const posts = getAllPatchPosts();

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
        <div className="mt-8 space-y-8">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-xl border border-border bg-card p-5"
            >
              <header className="mb-3">
                <h2 className="text-lg font-semibold">{post.title}</h2>
                <time className="text-xs text-muted-foreground">
                  {post.date}
                </time>
              </header>

              <div className="space-y-4">
                {post.sections.map((s) => (
                  <section key={s.heading}>
                    <h3 className="font-medium">{s.heading}</h3>
                    <ul className="mt-1 space-y-1 text-sm">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{renderInline(b)}</span>
                        </li>
                      ))}
                    </ul>
                    {s.note && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {renderInline(s.note)}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
