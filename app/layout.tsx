import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { STARTUP } from "@/app/_og/startup";
import { FirstVisit } from "@/components/FirstVisit";
import { homeGuideScript } from "@/lib/home";
import { themeCss, themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "TailQ",
  description: "매일 기술면접 질문 하나. AI가 채점하고 꼬리질문을 던져요.",
  icons: { apple: "/apple-touch-icon.png" },
  // 아이폰 홈 화면 앱의 시작 화면. 상태 표시줄은 기본값(default, 메타가 없을 때와 같다)이라 themeColor와 겹치지 않는다
  appleWebApp: {
    capable: true,
    startupImage: STARTUP,
  },
  // Next는 capable을 mobile-web-app-capable로만 내보낸다. 아이폰이 시작 화면을 쓰는 옛 이름도 같이 둔다
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // 다크·라이트를 직접 지원한다고 알려, 휴대폰 다크 모드 브라우저가 화면을 강제로 어둡게 칠하지 않게 한다(#171)
  colorScheme: "dark light",
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
        {/* 홈 첫 방문 안내를 닫은 브라우저면 첫 그림 전에 숨긴다 */}
        <script dangerouslySetInnerHTML={{ __html: homeGuideScript }} />
      </head>
      <body>
        <FirstVisit />
        {children}
      </body>
    </html>
  );
}
