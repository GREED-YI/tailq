import Link from "next/link";
import { Icon } from "./icons";

// 알림 설정은 MY에 있다. 받은 알림 목록이 없어 Figma의 민트 점(새 알림)은 두지 않는다.
// 모바일·태블릿 헤더(AppHeader)와 PC 내용 영역 오른쪽 위(PcTools)가 같이 쓴다
export function BellLink() {
  return (
    <Link href="/my" className="glass press icon-btn" aria-label="알림 설정">
      <Icon name="bell" />
    </Link>
  );
}

// 리포트(막대 차트 아이콘). 기록 탭에서 따로 나온 /report 화면으로 간다(#114)
export function ReportLink() {
  return (
    <Link href="/report" className="glass press icon-btn" aria-label="리포트">
      <Icon name="chart" />
    </Link>
  );
}
