"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * 숫자가 이전 값에서 현재 값으로 부드럽게 카운트업/다운되는 표시.
 * flash=true면 증가 시 초록, 감소 시 빨강으로 잠깐 강조 (드래프트 실시간 점수용).
 * prefers-reduced-motion이면 즉시 반영.
 */
export function AnimatedNumber({
  value,
  className,
  durationMs = 450,
  flash = false,
}: {
  value: number;
  className?: string;
  durationMs?: number;
  flash?: boolean;
}) {
  const [display, setDisplay] = useState(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = to;
    if (from === to) return;

    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    if (flash) {
      setDir(to > from ? "up" : "down");
      flashTimer = setTimeout(() => setDir(null), 650);
    }

    if (reducedMotion()) {
      setDisplay(to);
      return () => clearTimeout(flashTimer);
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - p) ** 3; // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
    };
  }, [value, durationMs, flash]);

  return (
    <span
      className={cn(
        "tabular-nums transition-colors duration-300",
        dir === "up" && "text-success",
        dir === "down" && "text-destructive",
        className,
      )}
    >
      {display.toLocaleString()}
    </span>
  );
}
