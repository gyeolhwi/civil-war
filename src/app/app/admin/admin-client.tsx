"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HeroImage,
  MapImage,
  ModeIcon,
  RoleIcon,
} from "@/components/ui/game-image";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COMP_LABEL_KO,
  FUNC_LABEL_KO,
  ROLE_LABEL_KO,
  ROLE_ORDER,
} from "@/constants/heroes";
import { MODE_LABEL_KO } from "@/constants/maps";
import type {
  Comp,
  GameMap,
  GameMode,
  Hero,
  HeroFunc,
  Role,
} from "@/domain/types";
import { cn } from "@/lib/utils";
import { saveHero, saveMap } from "./actions";
import { COMP_VALUES, FUNCS_BY_ROLE, MODE_VALUES, ROLE_VALUES } from "./schema";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-surface-2 px-2.5 text-sm text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:dark]";

// ── CSV ────────────────────────────────────────────────
function downloadCsv(filename: string, rows: string[][]) {
  const quote = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(quote).join(",")).join("\r\n");
  // BOM(﻿): Excel에서 한글 깨짐 방지
  const blob = new Blob([`﻿${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 토글 버튼 ───────────────────────────────────────────
function Toggle({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-40",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border/60 bg-surface-1 text-ink-muted hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

// ── 영웅 ───────────────────────────────────────────────
function HeroesPanel({ heroes }: { heroes: Hero[] }) {
  const [editing, setEditing] = useState<Hero | null>(null);
  const ordered = [...heroes].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
  );

  function exportCsv() {
    const header = ["code", "이름", "역할", "comp", "func", "활성"];
    const rows = ordered.map((h) => [
      h.code,
      h.nameKo,
      ROLE_LABEL_KO[h.role],
      h.comp.join("|"),
      h.func.join("|"),
      h.isActive ? "Y" : "N",
    ]);
    downloadCsv("heroes.csv", [header, ...rows]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-subtle">{heroes.length}명</p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          CSV 다운로드
        </Button>
      </div>

      {ROLE_VALUES.map((role) => {
        const list = ordered.filter((h) => h.role === role);
        return (
          <section key={role} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink-subtle">
              <RoleIcon role={role} size={16} />
              {ROLE_LABEL_KO[role]} · {list.length}
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
              {list.map((h) => (
                <button
                  type="button"
                  key={h.code}
                  onClick={() => setEditing(h)}
                  title={`${h.nameKo} 편집`}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-surface-1 p-2 text-center transition-all hover:border-border hover:bg-surface-2",
                    !h.isActive && "opacity-45 grayscale",
                  )}
                >
                  <span className="relative w-full">
                    <HeroImage
                      code={h.code}
                      size={80}
                      className="aspect-square !h-auto !w-full rounded-lg transition-transform group-hover:scale-105"
                    />
                    {!h.isActive && (
                      <span className="absolute top-1 right-1 rounded-full bg-surface-3/90 px-1.5 py-0.5 text-[9px] font-medium text-ink-subtle ring-1 ring-background">
                        OFF
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-sm font-medium">
                    {h.nameKo}
                  </span>
                  <span className="flex min-h-4 flex-wrap justify-center gap-x-1 text-[11px] leading-tight text-ink-subtle">
                    {h.comp.map((c) => (
                      <span key={c}>#{COMP_LABEL_KO[c]}</span>
                    ))}
                    {h.func.map((f) => (
                      <span key={f} className="text-ink-tertiary">
                        {FUNC_LABEL_KO[f]}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {editing && (
        <HeroEditDialog
          key={editing.code}
          hero={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function HeroEditDialog({
  hero,
  onClose,
}: {
  hero: Hero;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameKo, setNameKo] = useState(hero.nameKo);
  const [role, setRole] = useState<Role>(hero.role);
  const [comp, setComp] = useState<Comp[]>(hero.comp);
  const [func, setFunc] = useState<HeroFunc[]>(hero.func);
  const [isActive, setIsActive] = useState(hero.isActive);

  function toggleComp(c: Comp) {
    setComp((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= 2) {
        toast.error("조합 성향은 최대 2개까지");
        return prev;
      }
      return [...prev, c];
    });
  }

  function toggleFunc(f: HeroFunc) {
    setFunc((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  function changeRole(next: Role) {
    setRole(next);
    setFunc((prev) => prev.filter((f) => FUNCS_BY_ROLE[next].includes(f)));
  }

  function submit() {
    startTransition(async () => {
      const res = await saveHero({
        code: hero.code,
        nameKo,
        role,
        comp,
        func: role === "tank" ? [] : func,
        isActive,
      });
      if (res.ok) {
        toast.success(`${nameKo} 저장됨`);
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeroImage code={hero.code} size={28} className="rounded" />
            영웅 편집 · {hero.code}
          </DialogTitle>
          <DialogDescription>
            comp는 1~2개(절제 규율), func는 역할에 맞는 것만. 저장 즉시 전역
            반영.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-subtle">이름</span>
            <Input value={nameKo} onChange={(e) => setNameKo(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-subtle">역할</span>
            <select
              className={selectClass}
              value={role}
              onChange={(e) => changeRole(e.target.value as Role)}
            >
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL_KO[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-subtle">조합 성향 (comp · 1~2개)</span>
            <div className="flex flex-wrap gap-1.5">
              {COMP_VALUES.map((c) => (
                <Toggle
                  key={c}
                  active={comp.includes(c)}
                  onClick={() => toggleComp(c)}
                >
                  {COMP_LABEL_KO[c]}
                </Toggle>
              ))}
            </div>
          </div>

          {role !== "tank" && (
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-ink-subtle">역할 내 기능 (func)</span>
              <div className="flex flex-wrap gap-1.5">
                {FUNCS_BY_ROLE[role].map((f) => (
                  <Toggle
                    key={f}
                    active={func.includes(f)}
                    onClick={() => toggleFunc(f)}
                  >
                    {FUNC_LABEL_KO[f]}
                  </Toggle>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-subtle">활성 (영웅 풀 노출)</span>
            <Toggle active={isActive} onClick={() => setIsActive((v) => !v)}>
              {isActive ? "활성" : "비활성"}
            </Toggle>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 맵 ─────────────────────────────────────────────────
function MapsPanel({ maps }: { maps: GameMap[] }) {
  const [editing, setEditing] = useState<GameMap | null>(null);

  function exportCsv() {
    const header = ["code", "이름", "모드", "활성"];
    const rows = maps.map((m) => [
      m.code,
      m.nameKo,
      MODE_LABEL_KO[m.mode],
      m.isActive ? "Y" : "N",
    ]);
    downloadCsv("maps.csv", [header, ...rows]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-subtle">
          {maps.length}개 · 활성 {maps.filter((m) => m.isActive).length}
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          CSV 다운로드
        </Button>
      </div>

      {MODE_VALUES.map((mode) => {
        const list = maps.filter((m) => m.mode === mode);
        if (list.length === 0) return null;
        return (
          <section key={mode} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-ink-subtle">
              <ModeIcon mode={mode} size={16} />
              {MODE_LABEL_KO[mode]} · {list.length}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((m) => (
                <button
                  type="button"
                  key={m.code}
                  onClick={() => setEditing(m)}
                  className="flex items-center gap-3 overflow-hidden rounded-xl border border-border/60 text-left transition-colors hover:bg-surface-2"
                >
                  <MapImage
                    code={m.code}
                    className="h-14 w-24 shrink-0"
                    cover
                  />
                  <span className="flex min-w-0 flex-1 items-center gap-2 py-2">
                    <span className="font-medium">{m.nameKo}</span>
                    {!m.isActive && <Badge variant="secondary">비활성</Badge>}
                  </span>
                  <span className="px-3 text-xs text-ink-subtle">편집</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {editing && (
        <MapEditDialog
          key={editing.code}
          map={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function MapEditDialog({
  map,
  onClose,
}: {
  map: GameMap;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameKo, setNameKo] = useState(map.nameKo);
  const [mode, setMode] = useState<GameMode>(map.mode);
  const [isActive, setIsActive] = useState(map.isActive);

  function submit() {
    startTransition(async () => {
      const res = await saveMap({ code: map.code, nameKo, mode, isActive });
      if (res.ok) {
        toast.success(`${nameKo} 저장됨`);
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>맵 편집 · {map.code}</DialogTitle>
          <DialogDescription>
            비활성 맵은 자동 맵 추첨 풀에서 제외됩니다. 저장 즉시 전역 반영.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-subtle">이름</span>
            <Input value={nameKo} onChange={(e) => setNameKo(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-subtle">모드</span>
            <select
              className={selectClass}
              value={mode}
              onChange={(e) => setMode(e.target.value as GameMode)}
            >
              {MODE_VALUES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL_KO[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-subtle">활성 (맵풀 노출)</span>
            <Toggle active={isActive} onClick={() => setIsActive((v) => !v)}>
              {isActive ? "활성" : "비활성"}
            </Toggle>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 메인 ───────────────────────────────────────────────
export function AdminClient({
  heroes,
  maps,
}: {
  heroes: Hero[];
  maps: GameMap[];
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8">
        <Link
          href="/app"
          className="text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <p className="mt-1 text-sm text-ink-subtle">
          슈퍼관리자 · 마스터 데이터
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          영웅·맵 관리
        </h1>
        <p className="mt-0.5 text-sm text-ink-subtle">
          분류·활성을 편집하면 배포 없이 앱 전역에 반영됩니다.
        </p>
      </header>

      <Tabs defaultValue="heroes">
        <TabsList>
          <TabsTrigger value="heroes">영웅</TabsTrigger>
          <TabsTrigger value="maps">맵</TabsTrigger>
        </TabsList>
        <TabsContent value="heroes" className="pt-4">
          <HeroesPanel heroes={heroes} />
        </TabsContent>
        <TabsContent value="maps" className="pt-4">
          <MapsPanel maps={maps} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
