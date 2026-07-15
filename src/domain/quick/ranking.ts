import type { BuiltTeam, Candidate } from "@/domain/team-builder";

/**
 * 후보 재정렬 — 점수차(diff)에 마이크 불균형을 타이브레이크로 얹는다.
 * 마이크 로직은 quick 모듈 안에만 둔다(공유 Participant 불가침).
 * (docs/discussion/paste-to-teams-plan.md §5.3)
 */

/** 마이크 불균형 1명당 가중치 (점수 환산) */
const MIC_WEIGHT = 200;
/** 상위 몇 개 후보를 대안으로 노출할지 */
export const ALTERNATIVE_POOL = 6;
/** 재정렬 대상 상위 후보 수 (전량 정렬 비용 회피) */
const RERANK_LIMIT = 30;

function noMicCount(
  team: BuiltTeam,
  noMicById: Record<string, boolean>,
): number {
  return team.members.filter((m) => noMicById[m.participant.id]).length;
}

/**
 * diff 오름차순 후보 목록을 받아 마이크 균형을 반영해 top N을 고른다.
 * 첫 요소가 최종 추천, 나머지는 대안.
 */
export function rankCandidates(
  candidates: Candidate[],
  noMicById: Record<string, boolean>,
): Candidate[] {
  const scored = candidates.slice(0, RERANK_LIMIT).map((c) => {
    const mic = Math.abs(
      noMicCount(c.teamA, noMicById) - noMicCount(c.teamB, noMicById),
    );
    return { c, rank: c.diff + mic * MIC_WEIGHT };
  });
  scored.sort((x, y) => x.rank - y.rank);
  return scored.slice(0, ALTERNATIVE_POOL).map((s) => s.c);
}
