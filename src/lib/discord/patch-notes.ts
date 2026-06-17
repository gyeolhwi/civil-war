// 오버워치 신규 소식 · 내전 봇 업데이트 패치노트.
//
// 새 소식이 생기면 PATCH_NOTES 배열 "맨 위"에 항목을 추가한다(최신순).
// "/패치노트" 슬래시 커맨드가 최근 항목들을 임베드로 보여준다.
// DB가 아니라 코드 상수로 두는 이유: 운영자가 배포와 함께 손쉽게 갱신하고,
// 별도 관리 화면 없이 PR/커밋 한 번으로 소식을 기록하기 위함.

export interface PatchNote {
  /** 표시용 날짜 (KST 기준, "YYYY-MM-DD"). */
  date: string;
  /** 한 줄 제목. */
  title: string;
  /** 변경 항목 (간단한 불릿). 마크다운 사용 가능. */
  items: string[];
  /**
   * 출처 표기 (오버워치 공식 소식을 옮긴 경우 필수).
   * scripts/patch-fetch.mjs 가 만들어주는 초안에 자동으로 채워진다.
   */
  source?: { label: string; url: string };
}

/** 나무늘보 오버워치 패치노트 재생목록 — 출처 표기·자동 수집의 기준. */
export const SOURCE_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLXWszO2dzkY37yutFFZDzT18segiVb0M2";

/** 최신순(맨 위가 가장 최근). 새 소식은 맨 앞에 추가. */
export const PATCH_NOTES: PatchNote[] = [
  {
    date: "2026-06-17",
    title: "신규 영웅 · 맵 추가",
    items: [
      "🦹 신규 영웅 **시온(Shion)** — 암살형 서브딜러",
      "🗺️ 신규 맵 **네온 정션(Neon Junction)**",
    ],
  },
];

/** 임베드에 한 번에 보여줄 최근 항목 수. */
const MAX_NOTES = 5;
const EPHEMERAL = 64; // 명령 실행자에게만 보이게 하는 플래그

/** `/패치노트` — 최근 패치노트를 실행자에게만 보이는 임베드로 응답한다. */
export function handlePatchNotes() {
  const notes = PATCH_NOTES.slice(0, MAX_NOTES);
  const fields = notes.map((n) => {
    const lines = n.items.map((i) => `• ${i}`);
    if (n.source) lines.push(`└ 출처: [${n.source.label}](${n.source.url})`);
    return { name: `📌 ${n.date} · ${n.title}`, value: lines.join("\n") };
  });

  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      embeds: [
        {
          title: "📰 오버워치 내전 패치노트",
          description: notes.length
            ? "최근 신규 소식·업데이트예요."
            : "아직 기록된 소식이 없어요.",
          color: 0x5865f2,
          ...(fields.length ? { fields } : {}),
          footer: { text: "오버워치 소식 출처: 나무늘보 패치노트 재생목록" },
        },
      ],
      flags: EPHEMERAL,
    },
  };
}
