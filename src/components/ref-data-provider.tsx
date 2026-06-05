"use client";

import { createContext, useContext } from "react";
import type { RefData } from "@/domain/types";

/**
 * 영웅·맵 마스터를 클라이언트에 동기 제공 (서버에서 1회 로드 → 루트 레이아웃에서 주입).
 * 코드 상수 import를 대체한다: `const { heroByCode } = useRefData()`.
 */
const RefDataContext = createContext<RefData | null>(null);

export function RefDataProvider({
  value,
  children,
}: {
  value: RefData;
  children: React.ReactNode;
}) {
  return (
    <RefDataContext.Provider value={value}>{children}</RefDataContext.Provider>
  );
}

export function useRefData(): RefData {
  const v = useContext(RefDataContext);
  if (!v) {
    throw new Error("useRefData는 RefDataProvider 안에서만 사용할 수 있습니다");
  }
  return v;
}
