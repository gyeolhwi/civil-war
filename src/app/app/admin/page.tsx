import { redirect } from "next/navigation";
import { getMyAdmin } from "@/lib/admin";
import { getRefData } from "@/lib/ref-data";
import { AdminClient } from "./admin-client";

/**
 * 영웅·맵 마스터 관리 (슈퍼관리자 전용).
 * 슈퍼가 아니면 대시보드로 리다이렉트. 데이터는 마스터(DB) 그대로 로드.
 */
export default async function AdminPage() {
  const admin = await getMyAdmin();
  if (!admin?.isSuper) redirect("/app");

  const { heroes, maps } = await getRefData();
  return <AdminClient heroes={heroes} maps={maps} />;
}
