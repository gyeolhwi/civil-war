"use client";

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
 * 영웅 초상. /heroes/<code>.jpg 가 있으면 이미지, 없으면 역할색 + 이름 이니셜 폴백.
 * 파일을 나중에 넣으면 자동으로 이미지로 표시됨.
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
  const box = { width: size, height: size };

  if (failed || !hero) {
    return (
      <span
        style={box}
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
    // biome-ignore lint/performance/noImgElement: public 정적 + onError 폴백 위해 img 사용
    <img
      src={hero.image}
      alt={hero.nameKo}
      style={box}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-full object-cover animate-in fade-in duration-300",
        className,
      )}
    />
  );
}

/**
 * 맵 이미지. /maps/<code>.jpg 가 있으면 이미지, 없으면 그라데이션 + 맵 이름 폴백.
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
    // biome-ignore lint/performance/noImgElement: public 정적 + onError 폴백 위해 img 사용
    <img
      src={map.image}
      alt={map.nameKo}
      onError={() => setFailed(true)}
      className={cn(
        "rounded-lg object-cover animate-in fade-in duration-300",
        className,
      )}
    />
  );
}
