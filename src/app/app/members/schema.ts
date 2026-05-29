import { z } from "zod";
import { HERO_CODES } from "@/constants/heroes";
import { MAPS } from "@/constants/maps";

const ROLES = ["tank", "dps", "support"] as const;
const TIERS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "master",
  "grandmaster",
  "champion",
] as const;
const MAP_CODES = MAPS.map((m) => m.code) as [string, ...string[]];

/** 역할 하나의 티어 입력. 입력 안 한 역할은 목록에서 제외 (SC-12). */
const roleRatingSchema = z.object({
  role: z.enum(ROLES),
  tier: z.enum(TIERS),
  division: z.number().int().min(1).max(5),
});

/** 배틀태그: 이름#1234 형식 */
const battleTagSchema = z
  .string()
  .trim()
  .regex(
    /^.+#\d{3,}$/u,
    "배틀태그는 이름#숫자 형식이어야 합니다 (예: 홍길동#1234)",
  );

export const memberFormSchema = z.object({
  /** 수정 시에만 존재 (글로벌 members.id) */
  memberId: z.string().uuid().optional(),
  battleTag: battleTagSchema,
  discordName: z.string().trim().max(100).optional().or(z.literal("")),
  primaryRole: z.enum(ROLES).optional().nullable(),
  secondaryRole: z.enum(ROLES).optional().nullable(),
  ratings: z.array(roleRatingSchema).superRefine((arr, ctx) => {
    const seen = new Set<string>();
    for (const r of arr) {
      if (seen.has(r.role)) {
        ctx.addIssue({ code: "custom", message: "역할 티어가 중복되었습니다" });
      }
      seen.add(r.role);
    }
  }),
  heroCodes: z
    .array(z.enum(HERO_CODES as [string, ...string[]]))
    .max(5, "선호 영웅은 최대 5개까지 선택할 수 있습니다"),
  mapCodes: z.array(z.enum(MAP_CODES)),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;
export type RoleRating = z.infer<typeof roleRatingSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };
