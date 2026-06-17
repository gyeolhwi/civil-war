// 오버워치 공식 패치 소식 + 내전 웹/봇 업데이트 패치노트.
//
// "/패치노트" 슬래시 커맨드가 두 영역을 "각각 다른 임베드"로 채널에 공개 게시한다.
//   1) 🎮 오버워치 공식 패치  — 출처: 나무늘보 패치노트 재생목록 (OVERWATCH_NEWS)
//   2) 🛠️ 내전 웹·봇 업데이트 — 우리 프로젝트 자체 변경 (APP_UPDATES)
//
// 새 소식은 각 배열 "맨 위"에 추가한다(최신순).
// 오버워치 쪽은 scripts/patch-fetch.mjs(`pnpm patch:fetch`)가 만들어주는 초안을
// OVERWATCH_NEWS 맨 위에 붙여넣는 사람-게이트 방식.

export interface PatchNote {
  /** 표시용 날짜·시즌 라벨 (예: "2026-06-17", "2026 시즌 2"). */
  date: string;
  /** 한 줄 제목. */
  title: string;
  /** 변경 항목 (간단한 불릿). 마크다운 사용 가능. */
  items: string[];
  /** 출처 표기 (오버워치 공식 소식을 옮긴 경우 필수). */
  source?: { label: string; url: string };
}

// 오버워치 공식 패치 소식의 출처는 "Blizzard 공식 패치노트 + 나무늘보 재생목록" 두 곳만 사용한다.
/** 나무늘보 오버워치 패치노트 재생목록 — 출처 표기·자동 수집의 기준. */
export const SOURCE_PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLXWszO2dzkY37yutFFZDzT18segiVb0M2";
/** Blizzard 공식 패치노트. */
export const BLIZZARD_PATCH_URL =
  "https://overwatch.blizzard.com/ko-kr/news/patch-notes/";

/**
 * 🎮 오버워치 공식 패치 소식 (최신순). 출처: Blizzard 공식 + 나무늘보만.
 * `pnpm patch:fetch` 초안을 이 배열 맨 위에 붙여넣어 갱신한다.
 */
export const OVERWATCH_NEWS: PatchNote[] = [
  {
    date: "2026 시즌 3 · 6/17",
    title: "호랑이 굴 속으로 — 신규 영웅 시온",
    items: [
      "🦹 52번째 신규 영웅 **시온(Shion)** — 하시모토 가문 옴닉, 쌍권총 딜러(오토바이 탑승·투척)",
      "🗺️ 일본 배경 신규 맵 추가 (시온 스토리 연계)",
      "🐯 시즌 3 '호랑이 굴 속으로' 시작",
    ],
    source: { label: "나무늘보 패치노트", url: SOURCE_PLAYLIST_URL },
  },
];

/**
 * 🛠️ 내전 웹·봇 자체 업데이트 (최신순). 오버워치 공식 패치와 무관.
 */
export const APP_UPDATES: PatchNote[] = [
  {
    date: "2026-06-17",
    title: "신규 콘텐츠 반영 + 패치노트 커맨드",
    items: [
      "🦹 신규 영웅 **시온** · 🗺️ 신규 맵 **네온 정션** 을 내전 웹에 추가 (프로필·밸런싱에서 선택 가능)",
      "📰 `/패치노트` 커맨드 추가 (지금 보고 있는 이것!)",
    ],
  },
];

/** 각 영역에서 한 번에 보여줄 최근 항목 수. */
const MAX_NOTES = 5;
const OVERWATCH_COLOR = 0xf99e1a; // 오버워치 주황
const APP_COLOR = 0x5865f2; // 디스코드 블루

/** 패치노트 배열 → 임베드 fields. 비어있으면 안내 필드 1개. */
function toFields(notes: PatchNote[]) {
  if (!notes.length) {
    return [{ name: "​", value: "_아직 등록된 소식이 없어요._" }];
  }
  return notes.slice(0, MAX_NOTES).map((n) => {
    const lines = n.items.map((i) => `• ${i}`);
    if (n.source) lines.push(`└ 출처: [${n.source.label}](${n.source.url})`);
    return { name: `📌 ${n.date} · ${n.title}`, value: lines.join("\n") };
  });
}

/**
 * `/패치노트` — 두 영역(오버워치 공식 / 내전 웹·봇)을 각각의 임베드로
 * 채널에 "공개 게시"한다(ephemeral 아님 → 모두에게 보이고 글로 남음).
 */
export function handlePatchNotes() {
  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE (공개)
    data: {
      embeds: [
        {
          title: "🎮 오버워치 공식 패치 소식",
          color: OVERWATCH_COLOR,
          fields: toFields(OVERWATCH_NEWS),
          footer: { text: "출처: Blizzard 공식 패치노트 · 나무늘보 재생목록" },
        },
        {
          title: "🛠️ 내전 웹·봇 업데이트",
          description:
            "_오버워치 공식 패치가 아니라, 이 내전 봇/웹의 자체 변경이에요._",
          color: APP_COLOR,
          fields: toFields(APP_UPDATES),
        },
      ],
    },
  };
}
