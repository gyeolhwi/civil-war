import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Civil War — 오버워치 내전 편성",
  description: "디스코드 채널별 오버워치 내전 팀 편성·운영·기록",
};

// Supabase(서울 ap-northeast-2)와 함수 리전을 맞춰 서버↔DB 왕복 지연 최소화.
export const preferredRegion = "icn1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="#5e6ad2" height={3} showSpinner={false} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
