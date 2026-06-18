"use client";

import { RulesContent } from "@/components/rules-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rulesSubset } from "@/lib/rules";

/**
 * "📜 내전 규칙" 버튼 → 모달. 결과 페이지 등에서 사용.
 * 모달엔 핵심 섹션(꼭 지켜주세요 + 게임 진행·매너·전적)만 추려 보여준다.
 */
export function RulesModal({
  body,
  label = "📜 내전 규칙",
}: {
  body: string;
  label?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="secondary">
            {label}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-3xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl">📜 내전 규칙</DialogTitle>
        </DialogHeader>
        <RulesContent body={rulesSubset(body)} large />
      </DialogContent>
    </Dialog>
  );
}
