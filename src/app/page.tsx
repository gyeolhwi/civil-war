import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-xl text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
        <p className="mb-4 text-sm font-medium tracking-widest text-ink-subtle">
          OVERWATCH 내전 편성
        </p>
        <h1 className="mb-5 text-6xl font-semibold tracking-tight text-foreground">
          Civil War
        </h1>
        <p className="mb-10 text-lg leading-relaxed text-ink-muted">
          티어와 포지션으로 균형 잡힌 팀을,
          <br />
          드래그 한 번으로.
        </p>
        <Link
          href="/login"
          className={buttonVariants({ size: "lg", className: "px-8" })}
        >
          내전 편성하기
        </Link>
        <p className="mt-6 text-sm text-ink-subtle">
          <Link
            href="/record"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            개인 전적 검색
          </Link>{" "}
          은 로그인 없이 이용할 수 있어요
        </p>
      </div>
    </main>
  );
}
