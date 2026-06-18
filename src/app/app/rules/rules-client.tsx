"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RulesContent } from "@/components/rules-content";
import { Button } from "@/components/ui/button";
import { DEFAULT_RULES_MD } from "@/lib/rules";
import { saveChannelRules } from "./actions";

export function RulesClient({
  initialBody,
  isCustom,
}: {
  initialBody: string;
  isCustom: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveChannelRules(body);
      if (!res.ok) {
        toast.error(res.error ?? "오류가 발생했어요");
        return;
      }
      toast.success("규칙을 저장했어요");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">📜 내전 규칙</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        이 채널의 규칙을 편집합니다. 마크다운으로 작성하며, 결과 화면 "📜 내전
        규칙" 버튼과 이 페이지에 반영됩니다.{" "}
        {isCustom ? "(현재: 채널 맞춤 규칙)" : "(현재: 기본 템플릿)"}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">편집</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBody(DEFAULT_RULES_MD)}
            >
              기본 템플릿 불러오기
            </Button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={28}
            maxLength={10000}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button onClick={save} disabled={pending || !body.trim()}>
            {pending ? "저장 중…" : "규칙 저장"}
          </Button>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">미리보기</span>
          <div className="rounded-xl border border-border bg-card p-5">
            <RulesContent body={body} />
          </div>
        </div>
      </div>
    </main>
  );
}
