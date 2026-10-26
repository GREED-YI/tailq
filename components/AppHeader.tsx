import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

// 모바일·태블릿 화면 위쪽 헤더(높이 64): 워드마크 + 테마 토글 + 알림.
// PC는 사이드 메뉴에 같은 것이 있어 숨긴다.
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className={s.header}>
      <Logo />
      <div className={s.headerTools}>
        {children}
        <ThemeToggle />
        <BellLink />
      </div>
    </header>
  );
}

// 알림 설정은 MY에 있다. 받은 알림 목록이 없어 Figma의 민트 점(새 알림)은 두지 않는다.
export function BellLink() {
  return (
    <Link href="/my" className="glass press icon-btn" aria-label="알림 설정">
      <Icon name="bell" />
    </Link>
  );
}
