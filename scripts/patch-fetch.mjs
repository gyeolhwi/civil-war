// 오버워치 패치노트 "보조 자동" 수집 스크립트 (2안).
//
// 나무늘보 패치노트 재생목록의 "최신 영상"을 찾아 → 자막(없으면 설명란)을
// Claude(claude-opus-4-8)로 핵심 3~5줄 요약 → src/lib/discord/patch-notes.ts 의
// PATCH_NOTES 배열 맨 위에 그대로 붙여넣을 수 있는 초안을 출력한다.
// 운영자가 초안을 한 번 확인·수정한 뒤 커밋하는 사람-게이트 방식.
//
// 실행: node --env-file=.env.local scripts/patch-fetch.mjs            (재생목록 최신 영상)
//       node --env-file=.env.local scripts/patch-fetch.mjs <영상URL|ID> (특정 영상 지정)
//
// 필요한 env: ANTHROPIC_API_KEY, YOUTUBE_API_KEY (YouTube Data API v3 키)
// 선택   env: PATCH_PLAYLIST_ID (기본값 = 나무늘보 패치노트 재생목록)

import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const PLAYLIST_ID =
  process.env.PATCH_PLAYLIST_ID || "PLXWszO2dzkY37yutFFZDzT18segiVb0M2";

for (const [key, value] of Object.entries({ ANTHROPIC_API_KEY, YOUTUBE_API_KEY })) {
  if (!value) {
    console.error(`✖ ${key} 가 설정되지 않았습니다 (.env.local 확인)`);
    process.exit(1);
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** 인자로 받은 영상 URL/ID 에서 11자리 videoId 추출. */
function parseVideoId(arg) {
  if (!arg) return null;
  const m = arg.match(/(?:v=|youtu\.be\/|\/shorts\/)([\w-]{11})/) ?? null;
  return m ? m[1] : /^[\w-]{11}$/.test(arg) ? arg : null;
}

/** 재생목록에서 "영상 게시일 기준" 가장 최신 항목을 가져온다. */
async function fetchLatestFromPlaylist() {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.search = new URLSearchParams({
    part: "snippet,contentDetails",
    maxResults: "20",
    playlistId: PLAYLIST_ID,
    key: YOUTUBE_API_KEY,
  }).toString();

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube playlistItems 실패 (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const items = (data.items ?? []).filter((it) => it.contentDetails?.videoId);
  if (!items.length) throw new Error("재생목록에 영상이 없습니다.");

  items.sort((a, b) => {
    const ta = Date.parse(a.contentDetails.videoPublishedAt ?? a.snippet.publishedAt);
    const tb = Date.parse(b.contentDetails.videoPublishedAt ?? b.snippet.publishedAt);
    return tb - ta; // 최신 먼저
  });
  const it = items[0];
  return {
    videoId: it.contentDetails.videoId,
    title: it.snippet.title,
    description: it.snippet.description ?? "",
    channel: it.snippet.videoOwnerChannelTitle ?? "나무늘보",
    publishedAt: it.contentDetails.videoPublishedAt ?? it.snippet.publishedAt,
  };
}

/** 특정 영상의 메타데이터(제목·설명·게시일·채널) 조회. */
async function fetchVideoMeta(videoId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    part: "snippet",
    id: videoId,
    key: YOUTUBE_API_KEY,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube videos 실패 (${res.status}): ${await res.text()}`);
  }
  const it = (await res.json()).items?.[0];
  if (!it) throw new Error(`영상을 찾을 수 없습니다: ${videoId}`);
  return {
    videoId,
    title: it.snippet.title,
    description: it.snippet.description ?? "",
    channel: it.snippet.channelTitle ?? "나무늘보",
    publishedAt: it.snippet.publishedAt,
  };
}

/** 문자열에서 key 에 해당하는 JSON 배열을 대괄호 균형으로 추출. */
function extractJsonArray(html, key) {
  const i = html.indexOf(`"${key}":`);
  if (i < 0) return null;
  const start = html.indexOf("[", i);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < html.length; j++) {
    if (html[j] === "[") depth++;
    else if (html[j] === "]" && --depth === 0) return html.slice(start, j + 1);
  }
  return null;
}

/**
 * 자막 추출 (베스트에포트). 워치 페이지에서 captionTracks 를 찾아 한국어 자막을
 * 받아온다. 데이터센터 IP(Vercel 등)에서는 차단되기 쉬워 운영자 로컬 실행 전제.
 * 실패하면 null → 설명란으로 폴백.
 */
async function fetchTranscript(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ko`, {
      headers: { "User-Agent": UA, "Accept-Language": "ko,en" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const raw = extractJsonArray(html, "captionTracks");
    if (!raw) return null;
    const tracks = JSON.parse(raw);
    if (!Array.isArray(tracks) || !tracks.length) return null;
    const track = tracks.find((t) => t.languageCode === "ko") ?? tracks[0];
    const capRes = await fetch(`${track.baseUrl}&fmt=json3`, {
      headers: { "User-Agent": UA },
    });
    if (!capRes.ok) return null;
    const data = await capRes.json();
    const text = (data.events ?? [])
      .flatMap((e) => (e.segs ?? []).map((s) => s.utf8 ?? ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

/** publishedAt(UTC ISO) → KST 기준 "YYYY-MM-DD". */
function kstDate(iso) {
  const kst = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** Claude 로 핵심 요약 (구조화 출력). */
async function summarize({ title, body, source }) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      items: { type: "array", items: { type: "string" } },
    },
    required: ["title", "items"],
  };

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema } },
    system:
      "너는 오버워치 내전 디스코드 봇의 패치노트 요약가다. 주어진 영상 자막/설명에서 " +
      "'우리 사용자(내전 참가자)에게 의미 있는' 핵심만 골라 한국어로 아주 간결하게 정리한다. " +
      "다룰 것: 신규/리워크 영웅, 신규 맵, 영웅 밸런스(버프·너프), 모드/UI 개선, 시즌·이벤트. " +
      "제외: 잡담, 인사, 광고, 구독 요청. items 는 3~5개, 각 한 줄(앞에 어울리는 이모지 1개). " +
      "과장·추측 금지. 자막에 없는 내용은 만들지 마라.",
    messages: [
      {
        role: "user",
        content:
          `영상 제목: ${title}\n\n` +
          `아래 본문(${source})에서 핵심 패치 내용을 요약해줘.\n\n` +
          `=== 본문 ===\n${body}\n`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  return JSON.parse(text);
}

// ── 실행 ─────────────────────────────────────────────────────────
const argId = parseVideoId(process.argv[2]);
const meta = argId ? await fetchVideoMeta(argId) : await fetchLatestFromPlaylist();
const watchUrl = `https://www.youtube.com/watch?v=${meta.videoId}`;

console.error(`▶ 대상 영상: ${meta.title}`);
console.error(`  ${watchUrl}  (게시 ${kstDate(meta.publishedAt)} KST)`);

const transcript = await fetchTranscript(meta.videoId);
const sourceKind = transcript ? "자막" : "영상 설명란";
const body = (transcript ?? meta.description).slice(0, 12000);
if (!transcript) {
  console.error("⚠ 자막을 가져오지 못해 '설명란' 기준으로 요약합니다 — 영상을 직접 확인하세요.");
}
if (!body.trim()) {
  console.error("✖ 자막·설명이 비어 요약할 내용이 없습니다. 영상 URL을 직접 지정해보세요.");
  process.exit(1);
}

const summary = await summarize({ title: meta.title, body, source: sourceKind });

const label = `나무늘보 · ${meta.title}`.slice(0, 90);
const draft = [
  "  {",
  `    date: ${JSON.stringify(kstDate(meta.publishedAt))},`,
  `    title: ${JSON.stringify(summary.title)},`,
  "    items: [",
  ...summary.items.map((i) => `      ${JSON.stringify(i)},`),
  "    ],",
  `    source: { label: ${JSON.stringify(label)}, url: ${JSON.stringify(watchUrl)} },`,
  "  },",
].join("\n");

console.error(
  `\n────────── 아래를 PATCH_NOTES 배열 맨 위에 붙여넣으세요 (출처 ${sourceKind} 기준, 검토 필수) ──────────\n`,
);
console.log(draft);
