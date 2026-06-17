import Link from "next/link";

const linkClass =
  "underline-offset-4 transition-colors hover:text-ink-muted hover:underline";

/** 모든 페이지 하단에 표시되는 공용 푸터 (루트 레이아웃에서 렌더). */
export function SiteFooter() {
  return (
    <footer className="px-6 py-6 text-center text-xs text-ink-subtle">
      © 2026 Civil War{" · "}
      <a
        href="https://github.com/gyeolhwi"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        GitHub
      </a>
      {" · "}Discord: gyeorrr
      <br />
      <Link href="/terms" className={linkClass}>
        이용약관
      </Link>
      {" · "}
      <Link href="/privacy" className={linkClass}>
        개인정보처리방침
      </Link>
    </footer>
  );
}
