import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 서버(RSC / Server Action / Route Handler)용 Supabase 클라이언트 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Component에서 호출되면 set이 막힐 수 있음 — 미들웨어가 세션을 갱신하므로 무시 가능
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // RSC 렌더 중 set 시도 — 무시
          }
        },
      },
    },
  );
}
