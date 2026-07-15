import { z } from "zod";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** 디스코드 전송 대상: "all" = 패치노트 채널이 설정된 모든 서버, uuid = 특정 서버 1곳. */
export const sendPatchSchema = z.object({
  postId: z.string().uuid(),
  target: z.union([z.literal("all"), z.string().uuid()]),
  // 이미 보낸 서버에 다시 보낼지. 일괄전송은 false 로 두어 멱등하게 동작시킨다.
  force: z.boolean(),
});

export interface SendTargetResult {
  channelId: string;
  channelName: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
}

export type SendResult =
  | { ok: true; results: SendTargetResult[] }
  | { ok: false; error: string };

export const patchPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력하세요")
    .max(120, "제목이 너무 길어요"),
  body: z
    .string()
    .trim()
    .min(1, "본문을 입력하세요")
    .max(8000, "본문이 너무 길어요"),
  published: z.boolean(),
});

export type PatchPostInput = z.infer<typeof patchPostSchema>;
