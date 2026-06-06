import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 정적 파일·이미지·favicon 제외한 모든 경로.
     * api/discord 는 Discord 서명검증 웹훅이라 세션 갱신이 불필요하고,
     * 3초 응답 제한이 있어 미들웨어(getUser 왕복)에서 제외한다.
     */
    "/((?!api/discord|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
