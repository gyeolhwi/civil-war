"use client";

import { toPng } from "html-to-image";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

/** 결과 보드를 PNG로 렌더 → 클립보드 복사 (디스코드 붙여넣기용, C1) */
export function useCopyImage() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const copyImage = useCallback(async () => {
    const node = boardRef.current;
    if (!node) return;
    setCopying(true);
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#0b0c10",
      });
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("결과 이미지를 클립보드에 복사했습니다.");
    } catch {
      toast.error("이미지 복사에 실패했습니다.");
    } finally {
      setCopying(false);
    }
  }, []);

  return { boardRef, copyImage, copying };
}
