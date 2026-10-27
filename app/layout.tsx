import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { FirstVisit } from "@/components/FirstVisit";
import { themeCss, themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "TailQ",
  description: "매일 기술면접 질문 하나. AI가 채점하고 꼬리질문을 던져요.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E0F0E" },
    { media: "(prefers-color-scheme: light)", color: "#F3F4F2" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={GeistMono.variable} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        {/* 첫 그림 전에 data-theme을 정한다(저장한 선택 → 기기 설정) */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <FirstVisit />
        {children}
      </body>
    </html>
  );
}
