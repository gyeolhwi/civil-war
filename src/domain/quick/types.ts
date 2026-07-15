import type { Division, Role, Tier } from "@/domain/types";

/**
 * 빠른편성(OWKR형식) 전용 로컬 타입.
 * 관리형 `Participant`와 분리해, 텍스트 파싱 결과가 공유 타입에 새지 않게 한다.
 * (docs/discussion/paste-to-teams-plan.md §3)
 */

/** 파싱된 한 역할의 티어·선호 정보 */
export interface ParsedRank {
  tier: Tier;
  division: Division;
  /** 선호 역할 (`!`) */
  preferred: boolean;
  /** 비선호 역할 (`?`) */
  avoided: boolean;
}

/** 붙여넣기 한 줄 → 파싱된 플레이어 (즉석·휘발) */
export interface ParsedPlayer {
  /** 닉네임#숫자 */
  battleTag: string;
  /** 파싱에 성공한 역할만 존재 (없는 역할 = 미입력) */
  ranks: Partial<Record<Role, ParsedRank>>;
  /** 마이크 미사용 (`X` 표기) */
  noMic: boolean;
}

/** 전체 텍스트 파싱 결과 */
export interface ParseResult {
  players: ParsedPlayer[];
  /** 닉네임은 있으나 티어를 못 읽은 줄 (수동 처리용) */
  failedLines: string[];
}
