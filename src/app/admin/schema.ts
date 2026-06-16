import { z } from "zod";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** 디스코드 스노우플레이크 ID — 17~20자리 숫자. */
const discordIdSchema = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/u, "디스코드 ID는 17~20자리 숫자여야 합니다");

/** 선택 입력용: 빈 문자열이면 null 로 정규화. */
const optionalDiscordId = z
  .union([z.literal(""), discordIdSchema])
  .transform((v) => (v === "" ? null : v));

const channelBaseSchema = {
  name: z.string().trim().min(1, "채널명을 입력하세요").max(100),
  discordGuildId: optionalDiscordId,
  discordChannelId: optionalDiscordId,
  ownerAdminId: z
    .union([z.literal(""), z.string().uuid()])
    .transform((v) => (v === "" ? null : v)),
};

export const channelCreateSchema = z.object(channelBaseSchema);
export const channelUpdateSchema = z.object({
  channelId: z.string().uuid(),
  ...channelBaseSchema,
});

/** 멤버 디스코드 ID 연결/해제 (빈 값이면 해제). */
export const memberDiscordSchema = z.object({
  memberId: z.string().uuid(),
  discordUserId: optionalDiscordId,
});

export type ChannelCreateValues = z.infer<typeof channelCreateSchema>;
export type ChannelUpdateValues = z.infer<typeof channelUpdateSchema>;
export type MemberDiscordValues = z.infer<typeof memberDiscordSchema>;
