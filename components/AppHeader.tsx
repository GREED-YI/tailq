import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

// 모바일·태블릿 화면 위쪽 헤더(높이 64). PC는 사이드 메뉴에 로고와 테마 토글이 있어 숨긴다.
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className={s.header}>
      <Logo />
      <div className={s.headerTools}>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
