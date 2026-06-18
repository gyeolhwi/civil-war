import type { ReactNode } from "react";

/** `**굵게**` 와 `[라벨](url)` 만 가볍게 렌더. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex 토큰화 표준 패턴
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <a
          key={k++}
          href={m[2]}
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 underline underline-offset-2"
        >
          {m[1]}
        </a>,
      );
    } else {
      nodes.push(<strong key={k++}>{m[3]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** 규칙 마크다운(제목/##섹션/불릿/인용)을 가볍게 렌더. large=라이브 공유용 큰 글씨. */
export function RulesContent({
  body,
  large = false,
}: {
  body: string;
  large?: boolean;
}) {
  const rootCls = large
    ? "space-y-2 text-base leading-relaxed sm:text-lg"
    : "space-y-1 text-sm leading-relaxed";
  const h2Cls = large ? "text-2xl font-bold" : "text-lg font-bold";
  const h3Cls = large ? "mt-4 text-lg font-semibold" : "mt-3 font-semibold";
  return (
    <div className={rootCls}>
      {body.split("\n").map((raw, i) => {
        const t = raw.trim();
        const key = `${i}-${t.slice(0, 16)}`;
        if (!t) return <div key={key} className="h-1.5" />;
        if (t.startsWith("# "))
          return (
            <h2 key={key} className={h2Cls}>
              {inline(t.slice(2))}
            </h2>
          );
        if (t.startsWith("## "))
          return (
            <h3 key={key} className={h3Cls}>
              {inline(t.slice(3))}
            </h3>
          );
        if (t.startsWith("> "))
          return (
            <p key={key} className="italic text-muted-foreground">
              {inline(t.slice(2))}
            </p>
          );
        const num = t.match(/^(\d+)\.\s+(.*)/);
        if (num)
          return (
            <div key={key} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">{num[1]}.</span>
              <span>{inline(num[2])}</span>
            </div>
          );
        if (t.startsWith("- ") || t.startsWith("• "))
          return (
            <div key={key} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">•</span>
              <span>{inline(t.replace(/^[-•]\s+/, ""))}</span>
            </div>
          );
        return <p key={key}>{inline(t)}</p>;
      })}
    </div>
  );
}
