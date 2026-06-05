import type { GameMode } from "@/domain/types";

// 맵 마스터 데이터(목록·mode·isActive)는 DB로 이관됨 (0003 마이그레이션).
// 로드는 서버 getRefData() / 클라 useRefData() 사용.
// 이 파일에는 enum 표시 라벨만 남긴다.

export const MODE_LABEL_KO: Record<GameMode, string> = {
  control: "점령",
  escort: "호위",
  hybrid: "혼합",
  push: "밀기",
  flashpoint: "플래시포인트",
  clash: "격돌",
};
