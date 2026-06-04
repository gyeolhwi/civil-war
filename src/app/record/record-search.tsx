"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PersonalRecordView } from "@/components/personal-record";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getRecord,
  type MemberHit,
  type RecordResult,
  searchMembers,
} from "./actions";

export function RecordSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[] | null>(null);
  const [selected, setSelected] = useState<MemberHit | null>(null);
  const [channel, setChannel] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [result, setResult] = useState<RecordResult | null>(null);
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
    setResult(null);
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
      setResult(res);
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
    setResult(null);
  }

  // 뒤로가기: 전적→(다채널이면)채널선택/(아니면)검색결과, 채널선택→검색결과
  function goBack() {
    if (result) {
      setResult(null);
      setChannel(null);
      if (!selected || selected.channels.length <= 1) setSelected(null);
      return;
    }
    if (selected) {
      setSelected(null);
      setChannel(null);
    }
  }

  const showBack = !!selected || !!result;

  return (
    <div className="flex flex-col gap-4">
      {/* 상시 검색바 */}
      <form onSubmit={runSearch} className="flex gap-2">
        {showBack && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={goBack}
            aria-label="뒤로"
          >
            ←
          </Button>
        )}
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

      {/* 전적 결과 */}
      {selected && channel && result ? (
        <div className="flex flex-col gap-3">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-subtle">
            {channel.name}
          </span>
          <PersonalRecordView
            stats={result.stats}
            profile={result.profile}
            memberId={selected.memberId}
          />
        </div>
      ) : selected && !channel ? (
        /* 채널 선택 (멤버가 여러 채널 소속) */
        <div className="flex flex-col gap-2">
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
      ) : hits !== null ? (
        /* 검색 결과 리스트 */
        hits.length === 0 ? (
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
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-1 px-4 py-3 text-left text-sm transition-colors hover:border-ring/60"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{m.battleTag}</span>
                    {m.discordName && (
                      <span className="text-xs text-ink-subtle">
                        {m.discordName}
                      </span>
                    )}
                  </span>
                  {m.channels.length > 0 && (
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {m.channels.map((c) => (
                        <Badge
                          key={c.id}
                          variant="outline"
                          className="font-normal"
                        >
                          {c.name}
                        </Badge>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
