import { Suspense, type ReactNode } from "react";
import { AdminHeaderLink } from "./AdminMenu";
import { BellLink, ReportLink } from "./BellLink";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

// 모바일·태블릿 화면 위쪽 헤더(높이 64). 홈은 워드마크 + 리포트 + 테마 토글 + 알림,
// 다른 탭은 제목(h1) + 리포트 + 테마 토글이다(Figma S10·S18·S19·S21·S22, 리포트는 #114에 더함).
// 운영자에게는 테마 토글 앞에 운영 대시보드 아이콘이 붙는다(#104).
// PC는 헤더를 숨기고 같은 도구를 내용 영역 오른쪽 위(PcTools)에 두며, 제목은 화면 안의 큰 h1이 맡는다.
export function AppHeader({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <header className={s.header}>
      {title ? (
        <h1 className={s.headerTitle}>{title}</h1>
      ) : (
        <Logo height={30} />
      )}
      <div className={s.headerTools}>
        {children}
        <ReportLink />
        <Suspense>
          <AdminHeaderLink />
        </Suspense>
        <ThemeToggle />
        {!title && <BellLink />}
      </div>
    </header>
  );
}

// PC(1024px~) 내용 영역 오른쪽 위 도구. 탭·하위 화면 레이아웃이 내용 위에 둔다.
// 운영 메뉴는 PC 사이드 메뉴에 있어 여기엔 없다
export function PcTools() {
  return (
    <div className={s.pcTools}>
      <ReportLink />
      <ThemeToggle />
      <BellLink />
    </div>
  );
}
