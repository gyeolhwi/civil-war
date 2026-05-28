import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardHeader>
          <CardTitle className="text-xl">관리자 로그인</CardTitle>
          <CardDescription>채널 관리자 아이디로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">
                {error === "empty"
                  ? "아이디와 비밀번호를 입력하세요."
                  : error === "unconfirmed"
                    ? "이메일 인증이 완료되지 않은 계정입니다. 관리자에게 문의하세요."
                    : "아이디 또는 비밀번호가 올바르지 않습니다."}
              </p>
            )}
            <Button type="submit" className="mt-2 w-full">
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
