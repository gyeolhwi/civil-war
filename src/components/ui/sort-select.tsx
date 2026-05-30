"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SortOption<T extends string> {
  key: T;
  label: string;
}

/** 정렬 기준 선택용 드롭다운 (목록 필터 형태). */
export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const labels = Object.fromEntries(options.map((o) => [o.key, o.label]));
  return (
    <Select value={value} onValueChange={(v) => v != null && onChange(v as T)}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue>
          {(v: string | null) => `정렬: ${v ? labels[v] : ""}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
