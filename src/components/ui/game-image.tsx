"use client";

import { useState } from "react";
import { useRefData } from "@/components/ref-data-provider";
import { ROLE_LABEL_KO } from "@/constants/heroes";
import { MODE_LABEL_KO } from "@/constants/maps";
import { TIER_LABEL_KO } from "@/constants/tiers";
import type { GameMap, GameMode, Hero, Role, Tier } from "@/domain/types";
import { cn } from "@/lib/utils";

// 이미지가 작아(맵 ~250KB·영웅 ~40KB) next/image 최적화보다 일반 img + 프리로드가
// 콜드 스타트 없이 매끄럽다. 모두 /public 정적 파일.

const ROLE_DOT: Record<Role, string> = {
  tank: "bg-role-tank",
  dps: "bg-role-dps",
  support: "bg-role-support",
};

const ROLE_BG: Record<Role, string> = {
  tank: "bg-role-tank/25 text-role-tank",
  dps: "bg-role-dps/25 text-role-dps",
  support: "bg-role-support/25 text-role-support",
};

/**
 * 영웅·맵 이미지를 브라우저 캐시에 미리 로드. 워크플로우 진입 시 1회 호출하면
 * 맵 추첨·영웅 그리드 단계에서 즉시 표시된다. idle 시점에 실행.
 */
export function preloadGameImages(heroes: Hero[], maps: GameMap[]) {
  if (typeof window === "undefined") return;
  const warm = () => {
    for (const h of heroes) {
      const img = new Image();
      img.src = h.image;
    }
    for (const m of maps) {
      if (!m.isActive) continue;
      const img = new Image();
      img.src = m.image;
    }
  };
  if ("requestIdleCallback" in window) {
    (
      window as unknown as { requestIdleCallback: (cb: () => void) => void }
    ).requestIdleCallback(warm);
  } else {
    setTimeout(warm, 300);
  }
}

/**
 * 역할 마크(SVG, 검은색→흰색 반전). 없으면 역할색 점 폴백.
 */
export function RoleIcon({
  role,
  size = 16,
  className,
}: {
  role: Role;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{ width: size * 0.6, height: size * 0.6 }}
        className={cn(
          "inline-block shrink-0 rounded-full",
          ROLE_DOT[role],
          className,
        )}
        title={ROLE_LABEL_KO[role]}
      />
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: 정적 + onError 폴백 + 프리로드
    <img
      src={`/images/roles/${role}.svg`}
      alt={ROLE_LABEL_KO[role]}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain brightness-0 invert", className)}
    />
  );
}

/**
 * 맵 유형(게임 모드) 아이콘. /images/modes/<mode>.png 있으면 표시, 없으면 모드명 첫 글자 폴백.
 */
export function ModeIcon({
  mode,
  size = 16,
  className,
}: {
  mode: GameMode;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center text-[10px] font-semibold text-ink-subtle",
          className,
        )}
        title={MODE_LABEL_KO[mode]}
      >
        {MODE_LABEL_KO[mode].slice(0, 1)}
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: 정적 + onError 폴백
    <img
      src={`/images/modes/${mode}.png`}
      alt={MODE_LABEL_KO[mode]}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * 영웅 초상. /images/heroes/<code>.png 있으면 표시, 없으면 역할색+이니셜 폴백.
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
  const { heroByCode } = useRefData();
  const [failed, setFailed] = useState(false);
  const hero = heroByCode[code];

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
    // biome-ignore lint/performance/noImgElement: 정적 + onError 폴백 + 프리로드
    <img
      src={hero.image}
      alt={hero.nameKo}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-full object-cover animate-in fade-in duration-300",
        className,
      )}
    />
  );
}

/**
 * 티어 엠블럼. /images/tiers/<tier>.png 있으면 표시, 없으면 티어명 첫 글자 폴백.
 */
export function TierImage({
  tier,
  size = 22,
  className,
}: {
  tier: Tier;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded text-[10px] font-semibold text-ink-subtle",
          className,
        )}
        title={TIER_LABEL_KO[tier]}
      >
        {TIER_LABEL_KO[tier].slice(0, 1)}
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: 정적 + onError 폴백 + 프리로드
    <img
      src={`/images/tiers/${tier}.png`}
      alt={TIER_LABEL_KO[tier]}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 object-contain animate-in fade-in duration-300",
        className,
      )}
    />
  );
}

/**
 * 맵 이미지. /images/maps/<code>.jpg 있으면 표시(전체 보이게 contain),
 * 없으면 그라데이션 + 이름 폴백. className으로 컨테이너 크기 지정(예: aspect-video w-full).
 */
export function MapImage({
  code,
  className,
  cover = false,
}: {
  code: string;
  className?: string;
  /** true면 영역을 꽉 채움(object-cover, 배너용). 기본은 object-contain. */
  cover?: boolean;
}) {
  const { mapByCode } = useRefData();
  const [failed, setFailed] = useState(false);
  const map = mapByCode[code];

  if (failed || !map) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-1 text-center text-sm font-medium text-ink-muted",
          className,
        )}
      >
        {map?.nameKo ?? code}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden bg-surface-1", className)}>
      {/* biome-ignore lint/performance/noImgElement: 정적 + onError 폴백 + 프리로드 */}
      <img
        src={map.image}
        alt={map.nameKo}
        onError={() => setFailed(true)}
        className={cn(
          "size-full animate-in fade-in duration-300",
          cover ? "object-cover" : "object-contain",
        )}
      />
    </div>
  );
}
