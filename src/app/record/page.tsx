import type { Metadata } from "next";
import { RecordSearch } from "./record-search";

export const metadata: Metadata = {
  title: "개인 전적 검색 — Civil War",
  description: "배틀태그·닉네임으로 내전 개인 전적을 검색하세요.",
};

export default function RecordPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-1">
        <p className="text-sm font-medium tracking-widest text-ink-subtle">
          CIVIL WAR
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          개인 전적 검색
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          로그인 없이 배틀태그·디스코드 닉네임으로 내 전적을 확인하세요.
        </p>
      </header>

      <RecordSearch />
    </main>
  );
}
