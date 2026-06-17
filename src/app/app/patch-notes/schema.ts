import { z } from "zod";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

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
