import { NextResponse } from "next/server";
import { handleRegister } from "@/lib/discord/register";
import { addReaction, postChannelMessage } from "@/lib/discord/rest";
import { verifyDiscordRequest } from "@/lib/discord/verify";

// 서명검증에 node:crypto 를 쓰므로 Edge 가 아닌 Node.js 런타임에서 실행.
export const runtime = "nodejs";

// 배포 버전 확인용. 등록된 엔드포인트 URL을 브라우저로 열면 이 값이 보인다.
// 디스코드는 GET 을 쓰지 않으므로 동작에 영향 없음.
const BUILD_MARKER = "reg-2026-06-15p-unified-selects";
export async function GET() {
  return NextResponse.json({ ok: true, marker: BUILD_MARKER });
}

// Discord 인터랙션/콜백 타입 (공식 문서: Receiving & Responding)
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;
const CallbackType = { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4 } as const;
const EPHEMERAL = 64; // 응답을 명령 실행자에게만 보이게 하는 플래그

interface DiscordInteraction {
  type: number;
  channel_id?: string;
  channel?: { id?: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: { name: string; value?: string | number | boolean }[];
  };
}

/** `/내전 날짜 시간` — 모집 공지 임베드를 채널에 올리고 ✅ 를 자동으로 단다. */
async function handleNaejeon(interaction: DiscordInteraction) {
  const options = interaction.data?.options ?? [];
  const get = (name: string) =>
    options.find((o) => o.name === name)?.value ?? "";
  const date = String(get("날짜"));
  const time = String(get("시간"));
  const channelId = interaction.channel_id ?? interaction.channel?.id;

  if (!channelId) {
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "채널 정보를 찾을 수 없어요.", flags: EPHEMERAL },
    });
  }

  try {
    // 인터랙션 응답이 아니라 봇 REST 메시지로 올려야 message.id 를 받아 ✅ 를 달 수 있다.
    const message = await postChannelMessage(channelId, {
      embeds: [
        {
          title: "🎮 오버워치 내전 모집",
          description: "참가하실 분은 아래 ✅ 를 눌러주세요!",
          color: 0x5865f2,
          fields: [
            { name: "📅 날짜", value: date, inline: true },
            { name: "⏰ 시간", value: time, inline: true },
          ],
        },
      ],
    });
    await addReaction(channelId, message.id, "✅");
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "✅ 내전 공지를 올렸어요!", flags: EPHEMERAL },
    });
  } catch (e) {
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `공지 게시 실패: ${e instanceof Error ? e.message : String(e)}`,
        flags: EPHEMERAL,
      },
    });
  }
}

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

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  // Discord 엔드포인트 등록 검증용 PING → PONG
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: CallbackType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data?.name === "내전") {
      return handleNaejeon(interaction);
    }
    if (interaction.data?.name === "내전-프로필") {
      return NextResponse.json(await handleRegister(interaction));
    }
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "알 수 없는 명령이에요.", flags: EPHEMERAL },
    });
  }

  // 등록 위저드의 버튼/모달 제출 (custom_id 가 reg: 로 시작)
  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT ||
    interaction.type === InteractionType.MODAL_SUBMIT
  ) {
    if (interaction.data?.custom_id?.startsWith("reg:")) {
      return NextResponse.json(await handleRegister(interaction));
    }
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "알 수 없는 동작이에요.", flags: EPHEMERAL },
    });
  }

  return new NextResponse("unhandled interaction type", { status: 400 });
}
