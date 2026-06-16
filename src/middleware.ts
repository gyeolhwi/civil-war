import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // admin.<도메인> 서브도메인은 관제 콘솔(/admin)로 보낸다.
  // 인증·쿠키는 기본 도메인에서 처리되므로 리다이렉트로 단순화한다.
  // (URL 을 admin.<도메인> 으로 유지하려면 쿠키 도메인(.<도메인>) 설정이 필요 — 추후)
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("admin.")) {
    const url = request.nextUrl.clone();
    url.host = host.replace(/^admin\./, "");
    if (!url.pathname.startsWith("/admin")) {
      url.pathname = `/admin${url.pathname === "/" ? "" : url.pathname}`;
    }
    return NextResponse.redirect(url);
  }
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
