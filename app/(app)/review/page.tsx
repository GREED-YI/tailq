import { permanentRedirect } from "next/navigation";

// 복습 목록은 기록 목록과 함께 내 질문(/questions)으로 합쳤다(#128).
// 옛 주소의 북마크·외부 링크는 오늘 복습할 질문으로 보낸다
export default function OldReviewPage() {
  permanentRedirect("/questions?filter=today");
}
