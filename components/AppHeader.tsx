import { Suspense, type ReactNode } from "react";
import { AdminHeaderLink } from "./AdminMenu";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

// 모바일·태블릿 화면 위쪽 헤더(높이 64). 홈은 워드마크, 다른 탭은 제목(h1). 오른쪽엔 테마 토글만
// (Figma S10·S18·S19·S21·S22). 운영자에게는 테마 토글 앞에 운영 대시보드 아이콘이 붙는다(#104).
// 처음엔 리포트·알림 아이콘도 있었는데, 알림은 MY로 가기만 해 빼고 리포트는 MY 메뉴·홈 링크(PC는 사이드 메뉴)로 옮겼다(#114).
// PC는 헤더를 숨기고 테마 토글을 내용 영역 오른쪽 위(PcTools)에 두며, 제목은 화면 안의 큰 h1이 맡는다.
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
        <Suspense>
          <AdminHeaderLink />
        </Suspense>
        <ThemeToggle />
      </div>
    </header>
  );
}

// PC(1024px~) 내용 영역 오른쪽 위 도구(테마 토글만). 탭·하위 화면 레이아웃이 내용 위에 둔다.
// 운영·리포트는 PC 사이드 메뉴에 있어 여기엔 없다
export function PcTools() {
  return (
    <div className={s.pcTools}>
      <ThemeToggle />
    </div>
  );
}
