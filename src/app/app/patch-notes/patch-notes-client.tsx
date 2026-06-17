"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPatchPost, deletePatchPost } from "./actions";

interface Post {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
}

const BODY_PLACEHOLDER = `🎮 오버워치 공식 패치
• ...

🛠️ 내전 웹·봇 업데이트
• ...

출처: Blizzard 공식 패치노트 · 나무늘보 패치노트`;

export function PatchNotesClient({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(true);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await createPatchPost({ title, body, published });
      if (!res.ok) {
        toast.error(res.error ?? "오류가 발생했어요");
        return;
      }
      toast.success("패치노트를 올렸어요");
      setTitle("");
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("이 패치노트를 삭제할까요?")) return;
    start(async () => {
      const res = await deletePatchPost(id);
      if (!res.ok) {
        toast.error(res.error ?? "오류가 발생했어요");
        return;
      }
      toast.success("삭제했어요");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold">📰 패치노트 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        제목·본문을 붙여넣고 올리면 공개 게시판(/patch)과 디스코드
        /패치노트(최신 1건)에 반영됩니다.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1">
          <Label htmlFor="pn-title">제목</Label>
          <Input
            id="pn-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 시즌 3 — 신규 영웅 시온"
            maxLength={120}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pn-body">본문 (붙여넣기)</Label>
          <textarea
            id="pn-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            maxLength={8000}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={BODY_PLACEHOLDER}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          바로 게시
        </label>
        <Button
          onClick={submit}
          disabled={pending || !title.trim() || !body.trim()}
        >
          {pending ? "올리는 중…" : "패치노트 올리기"}
        </Button>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted-foreground">
        올린 글 ({posts.length})
      </h2>
      <div className="mt-3 space-y-2">
        {posts.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {p.title}
                {!p.published && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (비공개)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.created_at.slice(0, 10)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(p.id)}
              disabled={pending}
            >
              삭제
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
