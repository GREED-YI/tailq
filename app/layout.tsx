import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TailQ",
  description: "매일 기술면접 질문 하나. AI가 채점하고 꼬리질문을 던져요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
