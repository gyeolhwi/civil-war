import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <>
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
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className={buttonVariants({ size: "lg", className: "px-8" })}
            >
              내전 편성하기
            </Link>
            <Link
              href="/record"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "px-8",
              })}
            >
              전적 검색
            </Link>
          </div>
          <p className="mt-6 text-sm text-ink-subtle">
            전적 검색은 로그인 없이 이용할 수 있어요
          </p>
        </div>
      </main>
      <footer className="px-6 py-6 text-center text-xs text-ink-subtle">
        © 2026 Civil War{" · "}
        <a
          href="https://github.com/gyeolhwi"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 transition-colors hover:text-ink-muted hover:underline"
        >
          GitHub
        </a>
        {" · "}Discord: gyeorrr
        <br />
        <Link
          href="/terms"
          className="underline-offset-4 transition-colors hover:text-ink-muted hover:underline"
        >
          이용약관
        </Link>
        {" · "}
        <Link
          href="/privacy"
          className="underline-offset-4 transition-colors hover:text-ink-muted hover:underline"
        >
          개인정보처리방침
        </Link>
      </footer>
    </>
  );
}
