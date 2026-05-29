"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** 서버 액션 제출 중 로딩 표시 (useFormStatus는 form 내부 자식에서만 동작) */
export function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="mt-2 w-full" disabled={pending}>
      {pending ? "로그인 중…" : "로그인"}
    </Button>
  );
}
