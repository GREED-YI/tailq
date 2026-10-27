import Link from "next/link";
import { Icon } from "./icons";

// 알림 설정은 MY에 있다. 받은 알림 목록이 없어 Figma의 민트 점(새 알림)은 두지 않는다.
// 헤더(AppHeader)와 PC 사이드 메뉴(AppNav, 클라이언트)가 같이 쓴다
export function BellLink() {
  return (
    <Link href="/my" className="glass press icon-btn" aria-label="알림 설정">
      <Icon name="bell" />
    </Link>
  );
}
