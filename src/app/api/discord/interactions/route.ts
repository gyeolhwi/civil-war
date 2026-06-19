import { after, NextResponse } from "next/server";
import { runMoveVoice } from "@/lib/discord/move-voice";
import { handlePatchNotes } from "@/lib/discord/patch-notes";
import { handleRegister, resolveChannelId } from "@/lib/discord/register";
import {
  addReaction,
  editOriginalInteraction,
  postChannelMessage,
} from "@/lib/discord/rest";
import { verifyDiscordRequest } from "@/lib/discord/verify";
import { createAdminClient } from "@/lib/supabase/admin";

// 서명검증에 node:crypto 를 쓰므로 Edge 가 아닌 Node.js 런타임에서 실행.
export const runtime = "nodejs";

// 배포 버전 확인용. 등록된 엔드포인트 URL을 브라우저로 열면 이 값이 보인다.
// 디스코드는 GET 을 쓰지 않으므로 동작에 영향 없음.
const BUILD_MARKER = "reg-2026-06-15u-rank-together-roletab";
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
const CallbackType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;
const EPHEMERAL = 64; // 응답을 명령 실행자에게만 보이게 하는 플래그

interface DiscordInteraction {
  type: number;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  channel?: { id?: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: { name: string; value?: string | number | boolean }[];
  };
}

/** KST 기준 "오늘 0시"의 UTC ISO 문자열 — 프리셋 번호 일별 초기화용. */
function startOfKstTodayIso(): string {
  const KST = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST);
  const kstMidnight = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
  );
  return new Date(kstMidnight - KST).toISOString();
}

/**
 * 채널의 오늘(KST) 프리셋 다음 순번. 동시 실행 시 드물게 중복될 수 있으나
 * 프리셋은 id(uuid)로 식별하고 code는 표시·선택 편의용이라 허용한다.
 */
async function nextPresetCode(
  sb: ReturnType<typeof createAdminClient>,
  channelId: string,
): Promise<number> {
  const { count } = await sb
    .from("match_presets")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channelId)
    .gte("created_at", startOfKstTodayIso());
  return (count ?? 0) + 1;
}

/** `/내전 날짜 시간` — 모집 공지 임베드를 채널에 올리고 ✅ 를 자동으로 단다. */
async function handleNaejeon(interaction: DiscordInteraction) {
  const options = interaction.data?.options ?? [];
  const get = (name: string) =>
    options.find((o) => o.name === name)?.value ?? "";
  const date = String(get("날짜"));
  const time = String(get("시간"));
  const discordChannelId = interaction.channel_id ?? interaction.channel?.id;

  if (!discordChannelId) {
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "채널 정보를 찾을 수 없어요.", flags: EPHEMERAL },
    });
  }

  try {
    // 프리셋(웹 자동선택용)을 위해 길드 → 내전 채널을 먼저 해석한다.
    // 채널 미연결이면 프리셋 없이 공지만 올린다.
    const sb = createAdminClient();
    const channelId = await resolveChannelId(sb, interaction.guild_id);
    const code = channelId ? await nextPresetCode(sb, channelId) : null;

    const presetNote = code
      ? `프리셋 #${code} · 웹 "내전 시작 → 프리셋 불러오기"로 ✅ 참가자 자동 선택`
      : undefined;

    // 인터랙션 응답이 아니라 봇 REST 메시지로 올려야 message.id 를 받아 ✅ 를 달 수 있다.
    const message = await postChannelMessage(discordChannelId, {
      embeds: [
        {
          title: "🎮 오버워치 내전 모집",
          description: "참가하실 분은 아래 ✅ 를 눌러주세요!",
          color: 0x5865f2,
          fields: [
            { name: "📅 날짜", value: date, inline: true },
            { name: "⏰ 시간", value: time, inline: true },
          ],
          ...(presetNote ? { footer: { text: presetNote } } : {}),
        },
      ],
    });
    await addReaction(discordChannelId, message.id, "✅");

    // 프리셋 저장 (메시지 게시 후). 실패해도 공지는 이미 올라갔으므로 무시.
    if (channelId && code) {
      await sb.from("match_presets").insert({
        channel_id: channelId,
        code,
        label: `${date} ${time}`.trim(),
        discord_channel_id: discordChannelId,
        discord_message_id: message.id,
      });
    }

    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: code
          ? `✅ 내전 공지를 올렸어요! (프리셋 #${code})`
          : "✅ 내전 공지를 올렸어요!",
        flags: EPHEMERAL,
      },
    });
  } catch (e) {
    return NextResponse.json({
      type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `⚠️ ${e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요."}`,
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
    if (interaction.data?.name === "패치노트") {
      return NextResponse.json(await handlePatchNotes());
    }
    if (interaction.data?.name === "내전이동") {
      const codeOpt = interaction.data.options?.find((o) => o.name === "코드");
      const code = typeof codeOpt?.value === "number" ? codeOpt.value : null;
      const token = interaction.token;
      // 3초 제한 회피: 먼저 "처리 중"(deferred)으로 응답하고, 실제 이동은 응답 후 처리.
      after(async () => {
        let msg: string;
        try {
          msg = await runMoveVoice(interaction.guild_id, code);
        } catch (e) {
          msg = `이동 처리 중 오류: ${e instanceof Error ? e.message : String(e)}`;
        }
        if (token) await editOriginalInteraction(token, msg);
      });
      return NextResponse.json({
        type: CallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: EPHEMERAL },
      });
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
