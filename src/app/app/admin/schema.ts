import { z } from "zod";
import type { HeroFunc, Role } from "@/domain/types";

export const ROLE_VALUES = ["tank", "dps", "support"] as const;
export const COMP_VALUES = ["dive", "brawl", "poke"] as const;
export const MODE_VALUES = [
  "control",
  "escort",
  "hybrid",
  "push",
  "flashpoint",
  "clash",
] as const;

/** 역할별 허용 func (탱커는 없음 = comp가 곧 기능) */
export const FUNCS_BY_ROLE: Record<Role, HeroFunc[]> = {
  tank: [],
  dps: ["hitscan", "flanker", "projectile", "sub"],
  support: ["main_heal", "off_heal", "damage"],
};

/** 영웅 편집 — 분류 절제 규율(comp 1~2개·역할별 func)을 검증 */
export const heroEditSchema = z
  .object({
    code: z.string().min(1),
    nameKo: z.string().trim().min(1, "이름을 입력하세요"),
    role: z.enum(ROLE_VALUES),
    comp: z
      .array(z.enum(COMP_VALUES))
      .min(1, "조합 성향(comp)을 1개 이상 선택하세요")
      .max(2, "조합 성향은 최대 2개까지 (절제 규율)"),
    func: z.array(z.string()),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.comp).size !== v.comp.length) {
      ctx.addIssue({ code: "custom", message: "조합 성향이 중복되었습니다" });
    }
    const allowed = FUNCS_BY_ROLE[v.role];
    if (v.role === "tank") {
      if (v.func.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "탱커는 기능(func)을 비워야 합니다",
        });
      }
      return;
    }
    if (v.func.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "딜러·힐러는 기능(func)을 1개 이상 선택하세요",
      });
    }
    for (const f of v.func) {
      if (!allowed.includes(f as HeroFunc)) {
        ctx.addIssue({
          code: "custom",
          message: `${v.role} 역할에 맞지 않는 기능: ${f}`,
        });
      }
    }
  });

/** 맵 편집 — 이름·모드·활성만 */
export const mapEditSchema = z.object({
  code: z.string().min(1),
  nameKo: z.string().trim().min(1, "이름을 입력하세요"),
  mode: z.enum(MODE_VALUES),
  isActive: z.boolean(),
});

export type HeroEditValues = z.infer<typeof heroEditSchema>;
export type MapEditValues = z.infer<typeof mapEditSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };
