import { NextResponse } from "next/server";
import { verifyDiscordRequest } from "@/lib/discord/verify";

// 서명검증에 node:crypto 를 쓰므로 Edge 가 아닌 Node.js 런타임에서 실행.
export const runtime = "nodejs";

// Discord 인터랙션/콜백 타입 (공식 문서: Receiving & Responding)
const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
const CallbackType = { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4 } as const;

/**
 * Discord 인터랙션 엔드포인트 (서버리스 / HTTP 인터랙션 방식).
 * Developer Portal의 "Interactions Endpoint URL"에 이 경로를 등록한다:
 *   https://<도메인>/api/discord/interactions
 * 등록 시 Discord가 PING을 보내 PONG 응답을 확인하므로, env(DISCORD_PUBLIC_KEY)가
 * 설정되고 배포된 뒤에 URL을 등록해야 한다.
 */
export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return new NextResponse("DISCORD_PUBLIC_KEY 가 설정되지 않았습니다", {
      status: 500,
    });
  }

  // 서명검증은 반드시 파싱 전 raw 본문으로 (서명 대상 = timestamp + rawBody).
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  const valid = verifyDiscordRequest(rawBody, signature, timestamp, publicKey);
  if (!valid) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  // Discord 엔드포인트 등록 검증용 PING → PONG
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: CallbackType.PONG });
  }

  // 슬래시 커맨드 — 실제 `/내전` 등 처리는 Phase 2에서 확장. 지금은 연결 확인용 응답.
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "🎮 Civil War 봇 연결 완료 — 곧 `/내전` 기능이 추가됩니다.",
      },
    });
  }

  return new NextResponse("unhandled interaction type", { status: 400 });
}
