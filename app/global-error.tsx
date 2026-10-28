"use client";

import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";
import { themeCss, themeScript } from "@/lib/theme";

// 루트 레이아웃까지 터진 오류. layout을 대신하므로 html·body와 테마를 직접 그린다(app/error.tsx는 layout 안쪽만 받는다)
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <title>TailQ</title>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ErrorScreen reset={reset} />
      </body>
    </html>
  );
}
