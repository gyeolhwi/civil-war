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

// ── 에러 메시지 사람이 읽기 쉽게 ────────────────────────────────────────────
// Discord REST 오류(상태코드 + 본문 code)를 작업별 안내문으로 바꾼다.
// 가장 흔한 건 403 Missing Access(50001) — 봇이 그 채널에 안 들어가 있거나
// 채널 권한이 없을 때. "Missing Access" 원문 대신 무엇을 고치면 되는지 알려준다.
type DiscordAction = "send" | "react" | "read";

/** 실패 응답에서 상태코드와 Discord 에러 code 를 뽑는다. */
async function readDiscordError(
  res: Response,
): Promise<{ status: number; code?: number }> {
  let code: number | undefined;
  try {
    const body = (await res.json()) as { code?: number };
    code = typeof body.code === "number" ? body.code : undefined;
  } catch {
    // 본문이 JSON 이 아니면 상태코드만 사용
  }
  return { status: res.status, code };
}

/** 작업·상태코드·에러코드 → 운영자가 바로 조치할 수 있는 한국어 안내문. */
function friendlyDiscordError(
  action: DiscordAction,
  status: number,
  code?: number,
): string {
  // 권한/접근 문제 (가장 흔함)
  if (status === 403) {
    // 50001 Missing Access = 봇이 그 채널을 아예 못 봄
    if (code === 50001) {
      return "봇이 이 채널에 접근할 수 없어요. 채널 설정 → 권한에서 봇에게 ‘채널 보기’ 권한을 허용해주세요. (봇이 이 채널 멤버가 아닐 때 나는 오류예요)";
    }
    // 50013 Missing Permissions 등 = 채널엔 들어왔는데 특정 행동 권한이 없음
    if (action === "send") {
      return "봇이 이 채널에 글을 쓸 권한이 없어요. 채널 권한에서 봇에게 ‘메시지 보내기’와 ‘링크 임베드’를 허용해주세요.";
    }
    if (action === "react") {
      return "봇이 ✅ 반응을 달 권한이 없어요. 채널 권한에서 봇에게 ‘반응 추가’를 허용해주세요.";
    }
    return "봇이 이 채널의 반응을 읽을 권한이 없어요. 채널 권한에서 봇에게 ‘메시지 기록 보기’를 허용해주세요.";
  }
  // 대상이 사라짐
  if (status === 404) {
    if (action === "read") {
      return "모집 메시지를 찾을 수 없어요. 삭제됐을 수 있으니 /내전 으로 다시 공지를 올려주세요.";
    }
    return "채널을 찾을 수 없어요. 삭제됐거나 봇이 볼 수 없는 채널이에요.";
  }
  if (status === 401) {
    return "봇 인증에 실패했어요(봇 토큰 문제). 관리자에게 문의해주세요.";
  }
  if (status === 429) {
    return "요청이 너무 잦아요. 잠시 후 다시 시도해주세요.";
  }
  const label =
    action === "send"
      ? "공지 게시"
      : action === "react"
        ? "✅ 반응 추가"
        : "반응 조회";
  return `${label} 중 알 수 없는 오류가 발생했어요 (코드 ${status}${code ? `/${code}` : ""}). 잠시 후 다시 시도해주세요.`;
}

async function discordError(
  res: Response,
  action: DiscordAction,
): Promise<Error> {
  const { status, code } = await readDiscordError(res);
  return new Error(friendlyDiscordError(action, status, code));
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
  if (!res.ok) throw await discordError(res, "send");
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
  if (!res.ok) throw await discordError(res, "react");
}

/**
 * 메시지의 특정 이모지에 반응한 사용자 목록(최대 100명)을 반환한다.
 * 봇이 직접 단 ✅ 도 포함되지만, 봇은 멤버가 아니라 매핑 단계에서 자연히 걸러진다.
 */
export async function getReactionUsers(
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<{ id: string; username?: string; global_name?: string | null }[]> {
  const res = await fetch(
    `${API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?limit=100`,
    { headers: botHeaders() },
  );
  if (!res.ok) throw await discordError(res, "read");
  return (await res.json()) as {
    id: string;
    username?: string;
    global_name?: string | null;
  }[];
}
