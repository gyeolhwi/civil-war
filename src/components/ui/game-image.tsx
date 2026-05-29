"use client";

import Image from "next/image";
import { useState } from "react";
import { HERO_BY_CODE } from "@/constants/heroes";
import { MAP_BY_CODE } from "@/constants/maps";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/utils";

const ROLE_BG: Record<Role, string> = {
  tank: "bg-role-tank/25 text-role-tank",
  dps: "bg-role-dps/25 text-role-dps",
  support: "bg-role-support/25 text-role-support",
};

/**
 * 영웅 초상. /heroes/<code>.png 가 있으면 next/image로 최적화 표시,
 * 없으면 역할색 + 이름 이니셜 폴백. 파일을 나중에 넣으면 자동 표시.
 */
export function HeroImage({
  code,
  size = 28,
  className,
}: {
  code: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const hero = HERO_BY_CODE[code];

  if (failed || !hero) {
    return (
      <span
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          hero ? ROLE_BG[hero.role] : "bg-surface-3 text-ink-subtle",
          className,
        )}
        title={hero?.nameKo}
      >
        {hero?.nameKo.slice(0, 2) ?? "?"}
      </span>
    );
  }

  return (
    <Image
      src={hero.image}
      alt={hero.nameKo}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-full object-cover animate-in fade-in duration-300",
        className,
      )}
    />
  );
}

/**
 * 맵 이미지. /maps/<code>.png 가 있으면 next/image(fill)로 표시,
 * 없으면 그라데이션 + 맵 이름 폴백. className으로 컨테이너 크기 지정(예: h-44 w-full).
 */
export function MapImage({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const map = MAP_BY_CODE[code];

  if (failed || !map) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-gradient-to-br from-surface-3 to-surface-1 text-center text-sm font-medium text-ink-muted",
          className,
        )}
      >
        {map?.nameKo ?? code}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface-1", className)}>
      <Image
        src={map.image}
        alt={map.nameKo}
        fill
        sizes="(max-width: 768px) 100vw, 640px"
        onError={() => setFailed(true)}
        className="object-contain animate-in fade-in duration-300"
      />
    </div>
  );
}
