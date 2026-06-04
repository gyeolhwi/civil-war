"use client";

import { HeroImage } from "@/components/ui/game-image";
import { HEROES_BY_ROLE, ROLE_LABEL_KO } from "@/constants/heroes";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-surface-2 px-2.5 text-sm text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:dark]";

/**
 * 배정 포지션 영웅을 여러 개 선택 (오버워치 영웅 교체 반영).
 * 선택 순서 보존. 중복 불가. 칩 × 로 제거.
 */
export function HeroMultiSelect({
  role,
  value,
  onChange,
  className,
}: {
  role: Role;
  value: string[];
  onChange: (codes: string[]) => void;
  className?: string;
}) {
  const options = HEROES_BY_ROLE[role].filter((h) => !value.includes(h.code));

  function add(code: string) {
    if (!code || value.includes(code)) return;
    onChange([...value, code]);
  }
  function remove(code: string) {
    onChange(value.filter((c) => c !== code));
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <select
        className={selectClass}
        value=""
        onChange={(e) => {
          add(e.target.value);
          e.target.value = "";
        }}
      >
        <option value="">
          {ROLE_LABEL_KO[role]} 영웅 추가
          {value.length > 0 && ` (${value.length})`}
        </option>
        {options.map((h) => (
          <option key={h.code} value={h.code}>
            {h.nameKo}
          </option>
        ))}
      </select>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => remove(code)}
              title="제거"
              className="flex items-center gap-1 rounded-full border border-border/60 bg-surface-1 py-0.5 pl-0.5 pr-2 text-xs transition-colors hover:border-destructive/50 hover:text-destructive"
            >
              <HeroImage code={code} size={18} />
              <span>
                {HEROES_BY_ROLE[role].find((h) => h.code === code)?.nameKo ??
                  code}
              </span>
              <span className="text-ink-subtle">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
