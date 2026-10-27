import { Suspense, type ReactNode } from "react";
import { AdminHeaderLink } from "./AdminMenu";
import { BellLink } from "./BellLink";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

// 모바일·태블릿 화면 위쪽 헤더(높이 64). 홈은 워드마크 + 테마 토글 + 알림,
// 다른 탭은 제목(h1) + 테마 토글만 있다(Figma S10·S18·S19·S21·S22).
// 운영자에게는 테마 토글 앞에 운영 대시보드 아이콘이 붙는다(#104).
// PC는 사이드 메뉴에 같은 것이 있어 숨기고, 제목은 화면 안의 큰 h1이 맡는다.
export function AppHeader({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <header className={s.header}>
      {title ? <h1 className={s.headerTitle}>{title}</h1> : <Logo />}
      <div className={s.headerTools}>
        {children}
        <Suspense>
          <AdminHeaderLink />
        </Suspense>
        <ThemeToggle />
        {!title && <BellLink />}
      </div>
    </header>
  );
}
