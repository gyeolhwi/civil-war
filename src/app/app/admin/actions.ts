"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getMyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, heroEditSchema, mapEditSchema } from "./schema";

/**
 * 영웅 마스터 수정 (슈퍼관리자 전용).
 * RLS(is_super)가 1차 방어, 액션의 getMyAdmin 검사가 2차 방어.
 * 성공 시 ref-data 캐시 무효화 → 앱 전역에 즉시 반영.
 */
export async function saveHero(raw: unknown): Promise<ActionResult> {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) return { ok: false, error: "슈퍼관리자만 가능합니다" };

  const parsed = heroEditSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("heroes")
    .update({
      name_ko: v.nameKo,
      role: v.role,
      comp: v.comp,
      func: v.func,
      is_active: v.isActive,
    })
    .eq("code", v.code);
  if (error) return { ok: false, error: "저장 중 오류가 발생했습니다" };

  updateTag("ref-data");
  revalidatePath("/app/admin");
  return { ok: true };
}

/** 맵 마스터 수정 (슈퍼관리자 전용). */
export async function saveMap(raw: unknown): Promise<ActionResult> {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) return { ok: false, error: "슈퍼관리자만 가능합니다" };

  const parsed = mapEditSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "입력값 오류",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("maps")
    .update({ name_ko: v.nameKo, mode: v.mode, is_active: v.isActive })
    .eq("code", v.code);
  if (error) return { ok: false, error: "저장 중 오류가 발생했습니다" };

  updateTag("ref-data");
  revalidatePath("/app/admin");
  return { ok: true };
}
