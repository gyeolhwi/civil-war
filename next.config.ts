import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 패치노트 마크다운(content/patch-notes/*.md)을 런타임에 fs로 읽으므로,
  // 해당 파일들을 서버리스 함수 번들에 포함시킨다(없으면 Vercel에서 글을 못 읽음).
  outputFileTracingIncludes: {
    "/api/discord/interactions": ["./content/patch-notes/**"],
    "/patch": ["./content/patch-notes/**"],
  },
};

export default nextConfig;
