// Discord REST API 호출 헬퍼 (봇 토큰 기반).
// HTTP 인터랙션 방식에서 "행동"(메시지 전송·반응 추가 등)은 REST로 처리한다.
// 봇 토큰은 서버 전용 env(DISCORD_BOT_TOKEN) — 절대 클라이언트로 노출 금지.

const API_BASE = "https://discord.com/api/v10";

function botHeaders(): Record<string, string> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN 가 설정되지 않았습니다");
  }
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

/** 채널에 메시지(임베드 등)를 보낸다. 생성된 메시지 객체(id 포함)를 반환. */
export async function postChannelMessage(
  channelId: string,
  payload: unknown,
): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`메시지 전송 실패 (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { id: string };
}

/** 메시지에 봇이 직접 반응(이모지)을 단다. emoji 는 유니코드 문자 그대로. */
export async function addReaction(
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "PUT", headers: botHeaders() },
  );
  if (!res.ok) {
    throw new Error(`반응 추가 실패 (${res.status}): ${await res.text()}`);
  }
}

/**
 * 메시지의 특정 이모지에 반응한 사용자 목록(최대 100명)을 반환한다.
 * 봇이 직접 단 ✅ 도 포함되지만, 봇은 멤버가 아니라 매핑 단계에서 자연히 걸러진다.
 */
export async function getReactionUsers(
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<{ id: string; username?: string }[]> {
  const res = await fetch(
    `${API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?limit=100`,
    { headers: botHeaders() },
  );
  if (!res.ok) {
    throw new Error(`반응 조회 실패 (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { id: string; username?: string }[];
}
