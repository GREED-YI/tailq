import { permanentRedirect } from "next/navigation";

// 기록 목록은 복습 목록과 함께 내 질문(/questions)으로 합쳤다(#128).
// 옛 주소의 북마크·외부 링크는 전체 질문으로 보낸다
export default function OldHistoryPage() {
  permanentRedirect("/questions?filter=all");
}
