import type { Hero } from "@/domain/types";
import type { ResultKind } from "./personal-stats";

export const heroName = (
  code: string | null,
  heroByCode: Record<string, Hero>,
) => (code ? (heroByCode[code]?.nameKo ?? code) : null);

export const recordDateFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
});

// 한국 op.gg 관례: 승=파랑 / 패=빨강 / 무=중립
export const RESULT_META: Record<
  ResultKind,
  { label: string; chip: string; band: string; text: string }
> = {
  win: {
    label: "승",
    chip: "bg-sky-500/15 text-sky-300",
    band: "bg-sky-500",
    text: "text-sky-300",
  },
  loss: {
    label: "패",
    chip: "bg-rose-500/15 text-rose-300",
    band: "bg-rose-500",
    text: "text-rose-300",
  },
  draw: {
    label: "무",
    chip: "bg-surface-3 text-ink-muted",
    band: "bg-ink-tertiary",
    text: "text-ink-muted",
  },
  pending: {
    label: "미입력",
    chip: "bg-surface-3 text-ink-subtle",
    band: "bg-ink-tertiary/50",
    text: "text-ink-subtle",
  },
};
