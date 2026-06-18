import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMyChannel } from "@/lib/channel";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

const MENUS = [
  {
    href: "/app/match/new",
    title: "내전 시작",
    desc: "참가자 10명 선택부터 팀 편성·드래프트까지",
  },
  {
    href: "/app/members",
    title: "멤버 관리",
    desc: "채널 멤버 등록·수정, 티어·포지션·선호 입력",
  },
  {
    href: "/app/stats",
    title: "전적·통계",
    desc: "매치 기록과 개인 전적, 매치 수정·삭제",
  },
  {
    href: "/app/channel",
    title: "채널 정보",
    desc: "채널명·관리자 정보",
  },
  {
    href: "/app/rules",
    title: "내전 규칙",
    desc: "내전 규칙 안내·편집 (채널별)",
  },
];

const SUPER_MENUS = [
  {
    href: "/admin",
    title: "채널 관제",
    desc: "전체 채널 멤버·구성 관리, 채널/디스코드 연결 (슈퍼관리자)",
  },
  {
    href: "/app/admin",
    title: "영웅·맵 관리",
    desc: "영웅 분류·맵풀 편집, CSV 내보내기 (슈퍼관리자)",
  },
  {
    href: "/app/patch-notes",
    title: "패치노트",
    desc: "패치노트 작성·게시 → /patch·디스코드 /패치노트 반영 (슈퍼관리자)",
  },
  {
    href: "/app/security",
    title: "2단계 인증",
    desc: "관제 콘솔 접근용 2FA 설정 (슈퍼관리자)",
  },
];

export default async function Dashboard() {
  const supabase = await createClient();
  // 채널 조회는 user.id가 필요 없으므로 인증 확인과 병렬 실행
  const [
    {
      data: { user },
    },
    channel,
  ] = await Promise.all([supabase.auth.getUser(), getMyChannel()]);
  const username = user?.email?.split("@")[0] ?? "관리자";
  const { data: admin } = await supabase
    .from("admins")
    .select("display_name, is_super")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const displayName = admin?.display_name || username;
  const menus = admin?.is_super ? [...MENUS, ...SUPER_MENUS] : MENUS;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-subtle">채널 대시보드</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {channel?.name ?? "채널 미배정"}
          </h1>
          <p className="mt-0.5 text-sm text-ink-subtle">
            관리자 · {displayName}
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="sm">
            로그아웃
          </Button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {menus.map((menu, i) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="animate-in fade-in slide-in-from-bottom-2"
            style={{
              animationDuration: "300ms",
              animationDelay: `${i * 40}ms`,
              animationFillMode: "both",
            }}
          >
            <Card className="h-full transition-colors hover:bg-surface-2">
              <CardHeader>
                <CardTitle className="text-lg">{menu.title}</CardTitle>
                <CardDescription>{menu.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
