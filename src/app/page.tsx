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
      </div>
    </main>
  );
}
