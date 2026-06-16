"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyStepUp } from "./actions";

export function MfaStepUp({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");

  function onVerify() {
    startTransition(async () => {
      const res = await verifyStepUp(code);
      if (res.ok) {
        router.replace(next);
        router.refresh();
      } else {
        toast.error(res.error);
        setCode("");
      }
    });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>2단계 인증</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-ink-subtle">
          인증 앱에 표시된 6자리 코드를 입력하세요.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="totp-code">인증 코드</Label>
          <Input
            id="totp-code"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6) onVerify();
            }}
          />
        </div>
        <Button onClick={onVerify} disabled={pending || code.length !== 6}>
          {pending ? "확인 중…" : "확인"}
        </Button>
      </CardContent>
    </Card>
  );
}
