"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enrollTotp, unenrollTotp, verifyEnrollment } from "./actions";

interface EnrollState {
  factorId: string;
  qrCode: string;
  secret: string | null;
}

export function SecurityClient({
  enabledFactorId,
  isAal2,
}: {
  enabledFactorId: string | null;
  isAal2: boolean;
}) {
  if (enabledFactorId) {
    return <EnabledCard factorId={enabledFactorId} isAal2={isAal2} />;
  }
  return <EnrollCard />;
}

function EnabledCard({
  factorId,
  isAal2,
}: {
  factorId: string;
  isAal2: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onUnenroll() {
    startTransition(async () => {
      const res = await unenrollTotp(factorId);
      if (res.ok) {
        toast.success("2단계 인증을 해제했습니다");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>2단계 인증</span>
          <Badge variant="secondary">활성화됨</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-ink-subtle">
          로그인 시 인증 앱의 6자리 코드를 입력해야 합니다.
        </p>
        {!isAal2 && (
          <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-ink-subtle">
            해제하려면 먼저{" "}
            <Link href="/app/mfa?next=/app/security" className="underline">
              2단계 인증을 통과
            </Link>
            해야 합니다.
          </p>
        )}
        <div className="flex justify-between">
          <Button
            render={<Link href="/admin">관제 콘솔로 이동</Link>}
            variant="secondary"
            size="sm"
          />
          <Button
            variant="destructive"
            size="sm"
            onClick={onUnenroll}
            disabled={pending || !isAal2}
          >
            {pending ? "해제 중…" : "2FA 해제"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EnrollCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");

  function onStart() {
    startTransition(async () => {
      const res = await enrollTotp();
      if (res.ok) {
        setEnroll({
          factorId: res.factorId,
          qrCode: res.qrCode,
          secret: res.secret,
        });
      } else {
        toast.error(res.error);
      }
    });
  }

  function onVerify() {
    if (!enroll) return;
    startTransition(async () => {
      const res = await verifyEnrollment(enroll.factorId, code);
      if (res.ok) {
        toast.success("2단계 인증을 활성화했습니다");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2단계 인증 활성화</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!enroll ? (
          <>
            <p className="text-sm text-ink-subtle">
              인증 앱(Google Authenticator 등) 또는 macOS Apple 암호에 등록해
              계정을 보호합니다.
            </p>
            <Button onClick={onStart} disabled={pending}>
              {pending ? "준비 중…" : "활성화하기"}
            </Button>
          </>
        ) : (
          <>
            <ol className="flex flex-col gap-1 text-sm text-ink-subtle">
              <li>1. 아래 QR을 인증 앱으로 스캔 (또는 설정 키 입력)</li>
              <li>2. 앱에 표시된 6자리 코드를 입력하고 확인</li>
            </ol>

            <div className="flex justify-center rounded-lg border border-border/60 bg-white p-4">
              <QrView svg={enroll.qrCode} />
            </div>

            {enroll.secret && (
              <div className="flex flex-col gap-1">
                <Label>설정 키 (수동 입력용 · Apple 암호에 붙여넣기)</Label>
                <code className="select-all rounded-lg border border-border/60 bg-surface-2 px-3 py-2 text-sm break-all">
                  {enroll.secret}
                </code>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totp-code">인증 코드 (6자리)</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

            <Button onClick={onVerify} disabled={pending || code.length !== 6}>
              {pending ? "확인 중…" : "확인하고 활성화"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Supabase enroll 의 qr_code 는 raw SVG 문자열 또는 data-URI 둘 다 올 수 있어 정규화. */
function QrView({ svg }: { svg: string }) {
  const src = svg.trimStart().startsWith("<svg")
    ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    : svg;
  // biome-ignore lint/performance/noImgElement: data-URI QR(SVG)라 next/image 부적합
  return <img src={src} alt="2단계 인증 QR 코드" className="size-44" />;
}
