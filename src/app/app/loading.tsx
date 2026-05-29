/**
 * /app 하위 전 페이지 공통 로딩 스켈레톤.
 * 동적 RSC가 서버 쿼리를 끝낼 때까지, 클릭 즉시 이 골격을 보여줘 체감 속도를 높인다.
 */
export default function AppLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="mb-10 flex flex-col gap-2">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
        <div className="h-7 w-52 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 정적 스켈레톤
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border/60 bg-surface-1"
          />
        ))}
      </div>
    </main>
  );
}
