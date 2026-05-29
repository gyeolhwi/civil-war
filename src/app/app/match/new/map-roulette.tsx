"use client";

import { useEffect, useState } from "react";
import { MapImage } from "@/components/ui/game-image";
import { MAP_BY_CODE, MAPS } from "@/constants/maps";
import { cn } from "@/lib/utils";

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

const POOL = MAPS.filter((m) => m.isActive).map((m) => m.code);

/**
 * 맵 추첨 연출. 마운트되면 여러 맵을 빠르게 훑다가 점점 느려지며 finalCode에 안착.
 * 다시 추첨할 때마다 부모가 key를 바꿔 재마운트 → 다시 돌아간다.
 * prefers-reduced-motion이면 연출 없이 즉시 결과.
 */
export function MapRoulette({
  finalCode,
  fromFallback,
  preferredBy,
}: {
  finalCode: string;
  fromFallback: boolean;
  preferredBy: string[];
}) {
  const [display, setDisplay] = useState(finalCode);
  const [spinning, setSpinning] = useState(!reducedMotion());
  const [flash, setFlash] = useState(false); // 안착 직후 글로우 버스트

  // biome-ignore lint/correctness/useExhaustiveDependencies: 마운트 시 1회만 추첨 연출
  useEffect(() => {
    if (reducedMotion()) {
      setDisplay(finalCode);
      setSpinning(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 50;
    const tick = () => {
      if (cancelled) return;
      if (delay < 340) {
        setDisplay(POOL[Math.floor(Math.random() * POOL.length)]);
        delay *= 1.16;
        timer = setTimeout(tick, delay);
      } else {
        setDisplay(finalCode);
        setSpinning(false);
        setFlash(true);
        timer = setTimeout(() => {
          if (!cancelled) setFlash(false);
        }, 800);
      }
    };
    timer = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const finalMap = MAP_BY_CODE[finalCode];

  return (
    <>
      <div
        className={cn(
          "relative transition-shadow duration-500",
          !spinning && "ring-2 ring-primary ring-inset",
          flash && "shadow-2xl shadow-primary/50",
        )}
      >
        <MapImage
          code={display}
          className={cn(
            "aspect-video w-full transition-all duration-150",
            spinning
              ? "scale-[0.97] blur-[2px] brightness-75"
              : "animate-in zoom-in-95 duration-500 ease-out",
          )}
        />
        {spinning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/55 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              🎰 맵 추첨 중…
            </span>
          </div>
        )}
        {!spinning && (
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-lg animate-in fade-in zoom-in-50 duration-300">
            ✓ 확정
          </span>
        )}
      </div>
      <div className="px-4 py-4">
        <p className="text-sm text-ink-subtle">선택된 맵</p>
        <p
          className={cn(
            "text-xl font-semibold transition-opacity",
            spinning && "opacity-40",
          )}
        >
          {spinning
            ? (MAP_BY_CODE[display]?.nameKo ?? "…")
            : (finalMap?.nameKo ?? finalCode)}
        </p>
        <p className="mt-2 min-h-5 text-sm text-ink-subtle">
          {!spinning &&
            (fromFallback
              ? "선호 맵이 없어 전체 맵에서 무작위 선정"
              : `선호: ${preferredBy.join(", ")}`)}
        </p>
      </div>
    </>
  );
}
