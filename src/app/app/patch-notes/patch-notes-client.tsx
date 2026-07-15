"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPatchPost,
  deletePatchPost,
  sendPatchPostToDiscord,
  updatePatchPost,
} from "./actions";

interface Post {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at: string;
}

/** 패치노트 채널 ID 가 설정된 서버(=내전 채널)만 전송 대상으로 넘어온다. */
interface SendTarget {
  id: string;
  name: string;
}

interface SendRow {
  post_id: string;
  channel_id: string;
  sent_at: string;
}

const BODY_PLACEHOLDER = `🎮 오버워치 공식 패치
• ...

🛠️ 내전 웹·봇 업데이트
• ...

출처: Blizzard 공식 패치노트 · 나무늘보 패치노트`;

export function PatchNotesClient({
  posts,
  targets,
  sends,
}: {
  posts: Post[];
  targets: SendTarget[];
  sends: SendRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(true);
  const [pending, start] = useTransition();

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPublished(true);
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setTitle(post.title);
    setBody(post.body);
    setPublished(post.published);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit() {
    start(async () => {
      const payload = { title, body, published };
      const res = editingId
        ? await updatePatchPost(editingId, payload)
        : await createPatchPost(payload);
      if (!res.ok) {
        toast.error(res.error ?? "오류가 발생했어요");
        return;
      }
      toast.success(editingId ? "수정했어요" : "패치노트를 올렸어요");
      resetForm();
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
      if (editingId === id) resetForm();
      router.refresh();
    });
  }

  // 글 → (서버 → 전송시각). 전송 여부 배지와 재전송 확인에 쓴다.
  const sentByPost = new Map<string, Map<string, string>>();
  for (const s of sends) {
    const m = sentByPost.get(s.post_id) ?? new Map<string, string>();
    m.set(s.channel_id, s.sent_at);
    sentByPost.set(s.post_id, m);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold">📰 패치노트 관리</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        제목·본문을 붙여넣고 올리면 공개 게시판(/patch)과 디스코드
        /패치노트(최신 1건)에 반영됩니다. 디스코드 채널로 바로 보내려면 글의
        상세보기를 열어 전송하세요.
      </p>

      {/* 작성 / 수정 폼 */}
      <div
        ref={formRef}
        className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            {editingId ? "✏️ 글 수정" : "🆕 새 글 작성"}
          </h2>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              취소
            </Button>
          )}
        </div>
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
          게시(공개)
        </label>
        <Button
          onClick={submit}
          disabled={pending || !title.trim() || !body.trim()}
        >
          {pending ? "저장 중…" : editingId ? "수정 저장" : "패치노트 올리기"}
        </Button>
      </div>

      {/* 목록 */}
      <h2 className="mt-8 text-sm font-semibold text-muted-foreground">
        올린 글 ({posts.length})
      </h2>
      <div className="mt-3 space-y-2">
        {posts.map((p) => {
          const open = expandedId === p.id;
          return (
            <div key={p.id} className="rounded-lg border border-border">
              <div className="flex items-center justify-between gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : p.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-medium">
                    {p.title}
                    {!p.published && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (비공개)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.created_at.slice(0, 10)} ·{" "}
                    {open ? "접기 ▲" : "상세보기 ▼"}
                  </p>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(p)}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              {open && (
                <>
                  <pre className="overflow-x-auto whitespace-pre-wrap border-t border-border px-3 py-3 text-sm leading-relaxed">
                    {p.body}
                  </pre>
                  <SendPanel
                    post={p}
                    targets={targets}
                    sentMap={sentByPost.get(p.id)}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/** 글 하나를 디스코드로 보내는 패널 — 서버별 전송 상태 + 개별/일괄 전송. */
function SendPanel({
  post,
  targets,
  sentMap,
}: {
  post: Post;
  targets: SendTarget[];
  sentMap: Map<string, string> | undefined;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(target: "all" | string, force: boolean) {
    start(async () => {
      const res = await sendPatchPostToDiscord({
        postId: post.id,
        target,
        force,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const names = (status: string) =>
        res.results
          .filter((r) => r.status === status)
          .map((r) => r.channelName)
          .join(", ");
      const sent = names("sent");
      const skipped = names("skipped");
      if (sent) toast.success(`${sent}에 전송했어요`);
      if (skipped) toast.info(`${skipped}은(는) 이미 전송해서 건너뛰었어요`);
      for (const f of res.results.filter((r) => r.status === "failed")) {
        toast.error(`${f.channelName}: ${f.error}`);
      }
      router.refresh();
    });
  }

  if (targets.length === 0) {
    return (
      <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
        패치노트 채널 ID가 설정된 서버가 없어요. 관리자 → 채널 설정에서
        지정해주세요.
      </p>
    );
  }

  return (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          디스코드 전송
        </p>
        <Button
          size="sm"
          onClick={() => run("all", false)}
          disabled={pending || !post.published}
        >
          {pending ? "전송 중…" : "전체 서버 전송"}
        </Button>
      </div>

      <ul className="mt-2 space-y-1">
        {targets.map((t) => {
          const sentAt = sentMap?.get(t.id);
          return (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {t.name}
                {sentAt ? (
                  <span className="ml-1.5 text-xs text-emerald-500">
                    ✓ {sentAt.slice(0, 10)} 전송됨
                  </span>
                ) : (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    미전송
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !post.published}
                onClick={() => {
                  if (
                    sentAt &&
                    !window.confirm(`${t.name}에 이미 보냈어요. 다시 보낼까요?`)
                  ) {
                    return;
                  }
                  run(t.id, Boolean(sentAt));
                }}
              >
                {sentAt ? "재전송" : "전송"}
              </Button>
            </li>
          );
        })}
      </ul>

      {!post.published && (
        <p className="mt-2 text-xs text-muted-foreground">
          비공개 글은 전송할 수 없어요. ‘게시(공개)’로 바꾼 뒤 전송해주세요.
        </p>
      )}
    </div>
  );
}
