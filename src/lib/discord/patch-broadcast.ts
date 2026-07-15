import { postChannelMessage } from "./rest";

// 웹(/app/patch-notes)에서 작성한 패치노트를 디스코드 채널에 게시한다.
// 슬래시 커맨드 "/패치노트"(patch-notes.ts)와 달리 "웹에서 밀어넣는" 방향이고,
// 본문 전체가 디스코드 안에서 읽혀야 하므로 길면 자르지 않고 여러 메시지로 나눈다.

const APP_COLOR = 0x5865f2;
/** 임베드 description 한도는 4096 — 여유를 두고 4000 에서 끊는다. */
const MAX_DESC = 4000;

/**
 * 본문을 한도 이하 덩어리로 나눈다. 되도록 줄 경계에서 끊어 불릿이 쪼개지지 않게 하고,
 * 한 줄이 통째로 한도를 넘으면 그 줄만 강제로 자른다.
 */
export function splitBody(body: string, limit: number = MAX_DESC): string[] {
  const chunks: string[] = [];
  let cur = "";

  for (const line of body.split("\n")) {
    if (line.length > limit) {
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      for (let i = 0; i < line.length; i += limit) {
        chunks.push(line.slice(i, i + limit));
      }
      continue;
    }
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > limit) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);

  return chunks.length ? chunks : [body];
}

/** 제목은 첫 메시지에만, 날짜 푸터는 마지막 메시지에만 붙인다. */
export function buildPatchMessages(
  title: string,
  body: string,
  date: string,
): unknown[] {
  const chunks = splitBody(body);
  return chunks.map((chunk, i) => ({
    embeds: [
      {
        ...(i === 0 ? { title: `📰 ${title}` } : {}),
        description: chunk,
        color: APP_COLOR,
        ...(i === chunks.length - 1
          ? { footer: { text: `패치노트 · ${date}` } }
          : {}),
      },
    ],
  }));
}

/**
 * 한 채널에 패치노트를 게시하고 생성된 메시지 ID 목록을 돌려준다.
 * 순서가 보장돼야 하므로(1/2 다음 2/2) 순차 전송한다.
 * 권한 문제는 postChannelMessage 가 한국어 안내문으로 throw 한다.
 */
export async function sendPatchToChannel(
  discordChannelId: string,
  post: { title: string; body: string; created_at: string },
): Promise<string[]> {
  const messages = buildPatchMessages(
    post.title,
    post.body,
    post.created_at.slice(0, 10),
  );
  const ids: string[] = [];
  for (const payload of messages) {
    const msg = await postChannelMessage(discordChannelId, payload);
    ids.push(msg.id);
  }
  return ids;
}
