import { TIER_ORDER } from "@/constants/tiers";
import type { Division, Role } from "@/domain/types";
import type { ParsedPlayer, ParsedRank, ParseResult } from "./types";

/**
 * 디스코드 채팅 텍스트 → ParsedPlayer[] 파서.
 * OWKR Match(qtaghdi/owkr-match)의 파서를 저작권자 허락 하에 이식했다. 자세한 출처는 README 크레딧 참고.
 * 원본과 달리 점수는 담지 않고 civil-war `Tier`/`Division`까지만 뽑는다.
 * 점수 환산은 adapter가 `ratingScore`로 수행.
 */

/** 티어 문자열 → TIER_ORDER 인덱스(0-7). 못 찾으면 -1 */
function findTierIndex(tierStr: string): number {
  const normalized = tierStr.toLowerCase().trim();

  const tierMap: Record<string, number> = {
    브론즈: 0,
    브론: 0,
    브: 0,
    bronze: 0,
    br: 0,
    실버: 1,
    실: 1,
    silver: 1,
    si: 1,
    골드: 2,
    골: 2,
    gold: 2,
    go: 2,
    플래티넘: 3,
    플레티넘: 3,
    플래: 3,
    플레: 3,
    플: 3,
    platinum: 3,
    plat: 3,
    pl: 3,
    다이아몬드: 4,
    다이아: 4,
    다이: 4,
    다: 4,
    diamond: 4,
    dia: 4,
    di: 4,
    마스터: 5,
    마스: 5,
    마: 5,
    master: 5,
    ma: 5,
    그랜드마스터: 6,
    그마: 6,
    그: 6,
    grandmaster: 6,
    gm: 6,
    챔피언: 7,
    챔피: 7,
    챔: 7,
    champion: 7,
    champ: 7,
    ch: 7,
  };

  if (tierMap[normalized] !== undefined) return tierMap[normalized];

  for (const [key, idx] of Object.entries(tierMap)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) return idx;
  }
  return -1;
}

/** 역할 문자열/이모지 → Role. 못 찾으면 null */
function parseRole(roleStr: string): Role | null {
  const n = roleStr.toLowerCase().trim();

  if (n.includes("ob_tank")) return "tank";
  if (n.includes("oc_damage")) return "dps";
  if (n.includes("od_support")) return "support";

  if (n.includes("탱커") || n.includes("탱")) return "tank";
  if (n.includes("딜러") || n.includes("딜")) return "dps";
  if (n.includes("힐러") || n.includes("힐")) return "support";

  if (n === "t" || n.includes("tank")) return "tank";
  if (n === "d" || n.includes("dps") || n.includes("damage")) return "dps";
  if (
    n === "s" ||
    n.includes("support") ||
    n.includes("sup") ||
    n.includes("heal")
  )
    return "support";

  return null;
}

/** 괄호 안 예상 티어 추출 (예: "미배치(골)" → "골"). "배치/예상/중"은 무시 */
function extractEstimatedTier(text: string): string | null {
  const match = text.match(/\(([가-힣a-zA-Z]+)\)/);
  if (!match) return null;
  const inner = match[1];
  if (inner.match(/배치|예상|중/)) return null;
  return inner;
}

interface RankSegment {
  tierIdx: number;
  div: number;
  preferred: boolean;
  avoided: boolean;
}

/** 단일 세그먼트("다3", "미배치(골)" 등) → 티어/등급/선호 */
function parseRankSegment(segment: string): RankSegment | null {
  const preferred = segment.includes("!");
  const avoided = segment.includes("?");
  const cleanSegment = segment.replace(/[!?]/g, "").trim();

  if (cleanSegment.match(/미배치|unranked/i)) {
    const estimated = extractEstimatedTier(cleanSegment);
    if (estimated) {
      const tierIdx = findTierIndex(estimated);
      if (tierIdx !== -1) return { tierIdx, div: 3, preferred, avoided };
    }
    return null;
  }

  const withoutEstimate = cleanSegment
    .replace(/\(\s*예상[^)]*\)/g, "")
    .replace(/\(\s*배치\s*중\s*\)/g, "")
    .trim();

  const tierDivMatch = withoutEstimate.match(/^([가-힣a-zA-Z]+)\s*(\d)?$/);
  if (tierDivMatch) {
    const tierIdx = findTierIndex(tierDivMatch[1]);
    const div = tierDivMatch[2] ? Number.parseInt(tierDivMatch[2], 10) : 3;
    if (tierIdx !== -1) return { tierIdx, div, preferred, avoided };
  }
  return null;
}

/** 티어 인덱스/등급 → ParsedRank. 미배치(-1)면 null */
function createRank(
  tierIdx: number,
  div: number,
  preferred: boolean,
  avoided: boolean,
): ParsedRank | null {
  if (tierIdx < 0 || tierIdx >= TIER_ORDER.length) return null;
  const division = Math.min(5, Math.max(1, div)) as Division;
  return { tier: TIER_ORDER[tierIdx], division, preferred, avoided };
}

/** 티어 이모지 코드 → 티어 약어 */
function emojiToTier(emoji: string): string | null {
  const l = emoji.toLowerCase();
  if (l.includes("bronze")) return "브";
  if (l.includes("silver")) return "실";
  if (l.includes("gold")) return "골";
  if (l.includes("plat")) return "플";
  if (l.includes("diamond")) return "다";
  if (l.includes("master")) return "마";
  if (l.includes("grand")) return "그";
  if (l.includes("champ")) return "챔";
  return null;
}

/** 디스코드 이모지 제거 + 역할/티어 이모지 정보 추출 */
function extractEmojiInfo(text: string): {
  cleanText: string;
  emojiRoles: Role[];
} {
  const emojiRoles: Role[] = [];

  for (const part of text.split("/")) {
    const roleMatch = part.match(/:p(ob_tank|oc_damage|od_support):/i);
    if (roleMatch) {
      const role = parseRole(roleMatch[1]);
      if (role) emojiRoles.push(role);
    }
  }

  let cleanText = text.replace(/:p(ob_tank|oc_damage|od_support):/gi, "");
  cleanText = cleanText.replace(/:ow_[A-Za-z_]+:\s*(\d)/g, (m, div) => {
    const tierMatch = m.match(/:ow_[A-Za-z]*_([a-z]+):/i);
    if (tierMatch) {
      const tier = emojiToTier(tierMatch[1]);
      if (tier) return `${tier}${div}`;
    }
    return div;
  });
  cleanText = cleanText
    .replace(/:[a-zA-Z0-9_]+:/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { cleanText, emojiRoles };
}

const ORDER: Role[] = ["tank", "dps", "support"];

/** 한 줄 → ParsedPlayer. 유효 역할이 하나도 없으면 null */
export function parseLineToPlayer(line: string): ParsedPlayer | null {
  const trimmedLine = line.trim();
  const noMicMatch = trimmedLine.match(/\s+([XO])$/i);
  const noMic = noMicMatch ? noMicMatch[1].toUpperCase() === "X" : false;
  const cleanLine = trimmedLine.replace(/\s+[XO]$/i, "").trim();

  const nameMatch = cleanLine.match(/([^\s]+\s*#\s*\d+)/);
  if (!nameMatch) return null;

  const battleTag = nameMatch[1].replace(/\s+/g, "");
  let remainText = cleanLine
    .slice(cleanLine.indexOf(nameMatch[1]) + nameMatch[1].length)
    .trim();

  // 반복 마커 정규화 (★/!!! → !, ??? → ?)
  remainText = remainText
    .replace(/★+/g, "!")
    .replace(/!+/g, "!")
    .replace(/\?+/g, "?");

  const { cleanText, emojiRoles } = extractEmojiInfo(remainText);
  remainText = cleanText;

  const ranks: Partial<Record<Role, ParsedRank>> = {};

  const slashParts = remainText
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (slashParts.length >= 2) {
    let roleIndex = 0;
    for (let i = 0; i < slashParts.length; i++) {
      const part = slashParts[i];
      const roleMatch = part.match(
        /^[!?]?(탱(?:커)?|딜(?:러)?|힐(?:러)?|t|d|s)[!?]?\s*/i,
      );
      let currentRole: Role | null = null;
      let rankPart = part;
      let isRolePreferred = part.includes("!") && roleMatch !== null;
      let isRoleAvoided = part.includes("?") && roleMatch !== null;

      if (roleMatch) {
        currentRole = parseRole(roleMatch[1]);
        rankPart = part.slice(roleMatch[0].length).trim();
      }
      if (!currentRole && emojiRoles[i]) currentRole = emojiRoles[i];

      rankPart = rankPart
        .replace(/\(\s*배치\s*중\s*\)/g, "")
        .replace(/\(\s*예상[^)]*\)/g, "")
        .trim();

      if (!isRolePreferred && part.includes("!")) isRolePreferred = true;
      if (!isRoleAvoided && part.includes("?")) isRoleAvoided = true;

      const parsed = parseRankSegment(rankPart);
      if (parsed) {
        const rank = createRank(
          parsed.tierIdx,
          parsed.div,
          parsed.preferred || isRolePreferred,
          parsed.avoided || isRoleAvoided,
        );
        if (rank) {
          const target = currentRole ?? ORDER[roleIndex];
          if (target) ranks[target] = rank;
        }
      }
      if (!currentRole) roleIndex++;
    }
  } else {
    const normalizedText = remainText.replace(/[,]/g, " ");
    const roleRankPattern =
      /(탱(?:커)?|딜(?:러)?|힐(?:러)?|t|d|s)?\s*([!?]+)?\s*([가-힣a-zA-Z]+)\s*(\d)?\s*([!?]+)?/gi;
    const matches = [...normalizedText.matchAll(roleRankPattern)];

    let autoIndex = 0;
    let pendingRole: Role | null = null;
    let pendingPreferred = false;
    let pendingAvoided = false;

    for (const m of matches) {
      const roleStr = m[1];
      const roleMarker = m[2];
      const tierStr = m[3];
      const divStr = m[4];
      const tailMarker = m[5];

      if (!tierStr) continue;

      if (!roleStr) {
        const parsedRoleOnly = parseRole(tierStr);
        if (parsedRoleOnly) {
          pendingRole = parsedRoleOnly;
          pendingPreferred =
            !!roleMarker?.includes("!") || !!tailMarker?.includes("!");
          pendingAvoided =
            !!roleMarker?.includes("?") || !!tailMarker?.includes("?");
          continue;
        }
      }

      if (tierStr.match(/미배치|unranked|배치/i)) {
        if (!roleStr) autoIndex++;
        continue;
      }
      if (tierStr.match(/예상/)) continue;

      const tierIdx = findTierIndex(tierStr);
      if (tierIdx === -1) continue;

      const div = divStr ? Number.parseInt(divStr, 10) : 3;
      const hasRolePreferredMarker = roleStr
        ? remainText.includes(`${roleStr}!`)
        : false;
      const hasRoleAvoidedMarker = roleStr
        ? remainText.includes(`${roleStr}?`)
        : false;
      const preferred =
        !!roleMarker?.includes("!") ||
        !!tailMarker?.includes("!") ||
        hasRolePreferredMarker ||
        pendingPreferred;
      const avoided =
        !!roleMarker?.includes("?") ||
        !!tailMarker?.includes("?") ||
        hasRoleAvoidedMarker ||
        pendingAvoided;

      const rank = createRank(tierIdx, div, preferred, avoided);
      const explicitRole = roleStr ? parseRole(roleStr) : null;
      const target = explicitRole ?? pendingRole;

      if (rank) {
        if (target) {
          ranks[target] = rank;
        } else {
          const slot = ORDER[autoIndex];
          if (slot) ranks[slot] = rank;
          autoIndex++;
        }
      } else if (!target) {
        autoIndex++;
      }

      pendingRole = null;
      pendingPreferred = false;
      pendingAvoided = false;
    }
  }

  if (Object.keys(ranks).length === 0) return null;
  return { battleTag, ranks, noMic };
}

/** 닉네임만 있고 티어가 없는 줄이면 닉네임 반환 */
function extractNameOnly(line: string): string | null {
  const trimmed = line.trim();
  const nameMatch = trimmed.match(/^([^\s]+#\d{4,})$/);
  return nameMatch ? nameMatch[1] : null;
}

/** 티어 정보만 있는 줄인지 (닉네임 없는 티어 전용 줄) */
function hasTierInfoOnly(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/[^\s]+#\d{4,}/.test(trimmed)) return false;

  const n = trimmed.replace(/★/g, "!").replace(/!+/g, "!").replace(/\?+/g, "?");

  if (n === "-" || /미배치|unranked|배치/i.test(n)) return true;
  if (
    n.includes("/") ||
    n.includes(":pob_") ||
    n.includes(":poc_") ||
    n.includes(":pod_")
  )
    return true;
  if (
    /(탱(?:커)?|딜(?:러)?|힐(?:러)?|t|d|s)\s*[!?]?\s*[가-힣a-zA-Z]+\s*\d?/i.test(
      n,
    )
  )
    return true;
  if (/^[가-힣a-zA-Z]+\s*\d?\s*[!?]?$/.test(n)) return true;

  return false;
}

/** 전체 채팅 로그 → ParsedPlayer[] + 실패 줄 (닉네임 기준 중복 제거) */
export function parseMultipleLines(text: string): ParseResult {
  const lines = text.split("\n");
  const players: ParsedPlayer[] = [];
  const failedLines: string[] = [];
  const seen = new Set<string>();

  const key = (name: string) => name.trim().toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("역할 아이콘") || line.includes("—")) continue;
    if (!(line.includes("#") && line.match(/\d{4,}/))) continue;

    const nameOnly = extractNameOnly(line);
    if (nameOnly) {
      const tierLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && tierLines.length < 3) {
        if (!hasTierInfoOnly(lines[j])) break;
        tierLines.push(lines[j].trim());
        j++;
      }

      if (tierLines.length > 0) {
        const combined = `${nameOnly} ${tierLines.join(" / ")}`;
        const player = parseLineToPlayer(combined);
        if (player && !seen.has(key(player.battleTag))) {
          players.push(player);
          seen.add(key(player.battleTag));
        } else if (!seen.has(key(nameOnly))) {
          failedLines.push(nameOnly);
          seen.add(key(nameOnly));
        }
        i = j - 1;
        continue;
      }
      if (!seen.has(key(nameOnly))) {
        failedLines.push(nameOnly);
        seen.add(key(nameOnly));
      }
      continue;
    }

    const player = parseLineToPlayer(line);
    if (player && !seen.has(key(player.battleTag))) {
      players.push(player);
      seen.add(key(player.battleTag));
    } else {
      const m = line.match(/([^\s]+#\d{4,})/);
      if (m && !seen.has(key(m[1]))) {
        failedLines.push(m[1]);
        seen.add(key(m[1]));
      }
    }
  }

  return { players, failedLines };
}
