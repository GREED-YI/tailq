import { permanentRedirect } from "next/navigation";

// 리포트는 처음엔 기록 탭 안("기록 / 리포트")에 있었으나 별도 화면 /report로 옮겼다(#117).
// 옛 주소의 북마크·외부 링크는 새 주소로 보낸다
export default function OldReportPage() {
  permanentRedirect("/report");
}
