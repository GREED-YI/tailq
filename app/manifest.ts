import type { MetadataRoute } from "next";

// 웹 앱 매니페스트(#37). 아이폰은 홈 화면에 추가한 앱(standalone)에서만 웹 푸시를 받는다(iOS 16.4 이상).
// 아이콘은 #FF4F12(시그널 오렌지) 바탕에 #111312 어두운 Q 심볼(DESIGN.md logo-tailq, 2026-10-28 확정).
// 실행 화면 바탕·상단 색은 앱 기본 다크 canvas(#0E0F0E)로 둬 열리자마자 보이는 첫 화면과 이어지게 한다
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TailQ",
    short_name: "TailQ",
    description: "매일 기술면접 질문 하나. AI가 채점하고 꼬리질문을 던져요.",
    lang: "ko",
    start_url: "/home",
    display: "standalone",
    background_color: "#0E0F0E",
    theme_color: "#0E0F0E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
