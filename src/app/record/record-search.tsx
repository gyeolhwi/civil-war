"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PersonalRecordView } from "@/components/personal-record";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PersonalStats } from "@/lib/personal-stats";
import { getRecord, type MemberHit, searchMembers } from "./actions";

export function RecordSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[] | null>(null);
  const [selected, setSelected] = useState<MemberHit | null>(null);
  const [channel, setChannel] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [searching, startSearch] = useTransition();
  const [loading, startLoad] = useTransition();

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) {
      toast.error("두 글자 이상 입력하세요");
      return;
    }
    setSelected(null);
    setChannel(null);
    setStats(null);
    startSearch(async () => {
      const res = await searchMembers(query);
      setHits(res);
    });
  }

  function loadRecord(member: MemberHit, ch: { id: string; name: string }) {
    setSelected(member);
    setChannel(ch);
    startLoad(async () => {
      const res = await getRecord(member.memberId, ch.id);
      if (!res) {
        toast.error("전적을 불러오지 못했습니다");
        setChannel(null);
        return;
      }
      setStats(res);
    });
  }

  function pickMember(member: MemberHit) {
    if (member.channels.length === 0) {
      toast.error("소속된 채널이 없습니다");
      return;
    }
    if (member.channels.length === 1) {
      loadRecord(member, member.channels[0]);
      return;
    }
    setSelected(member);
    setChannel(null);
    setStats(null);
  }

  function reset() {
    setSelected(null);
    setChannel(null);
    setStats(null);
  }

  // ── 결과 화면 ──
  if (selected && channel && stats) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-lg font-medium">{selected.battleTag}</span>
            <span className="text-sm text-ink-subtle">{channel.name}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={reset}>
            다시 검색
          </Button>
        </div>
        <PersonalRecordView stats={stats} />
      </div>
    );
  }

  // ── 채널 선택 (멤버가 여러 채널 소속) ──
  if (selected && !channel) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={reset}
          className="self-start text-sm text-ink-subtle transition-colors hover:text-foreground"
        >
          ← 검색으로
        </button>
        <p className="text-sm">
          <span className="font-medium">{selected.battleTag}</span> — 채널을
          선택하세요
        </p>
        <div className="flex flex-wrap gap-2">
          {selected.channels.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => loadRecord(selected, c)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // ── 검색 화면 ──
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={runSearch} className="flex gap-2">
        <Input
          placeholder="배틀태그 또는 디스코드 닉네임"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <Button type="submit" disabled={searching}>
          {searching ? "검색 중…" : "검색"}
        </Button>
      </form>

      {hits !== null &&
        (hits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-sm text-ink-subtle">
            검색 결과가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hits.map((m) => (
              <li key={m.memberId}>
                <button
                  type="button"
                  onClick={() => pickMember(m)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-1 px-4 py-3 text-left text-sm transition-colors hover:border-ring/60"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{m.battleTag}</span>
                    {m.discordName && (
                      <span className="text-xs text-ink-subtle">
                        {m.discordName}
                      </span>
                    )}
                  </span>
                  <Badge variant="outline">{m.channels.length}개 채널</Badge>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
