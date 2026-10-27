"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { Logo } from "./Logo";
import s from "./AppShell.module.css";

// pc: PC 사이드 메뉴에만(모바일·태블릿 탭바는 5칸). short: 탭바처럼 좁은 곳에 쓰는 짧은 이름
const TABS: {
  href: string;
  label: string;
  icon: IconName;
  pc?: boolean;
  short?: string;
}[] = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/review", label: "복습", icon: "review" },
  { href: "/history", label: "기록", icon: "history" },
  // 처음엔 내용 영역 오른쪽 위 아이콘이었는데, 메뉴에서 바로 보이게 사이드 메뉴로 옮겼다(#114).
  // 모바일·태블릿은 MY 메뉴와 홈 링크로 들어간다
  { href: "/report", label: "리포트", icon: "chart", pc: true },
  { href: "/projects", label: "프로젝트", icon: "projects" },
  // 처음엔 "MY"였는데, 화면 제목과 같게 "MY페이지"로 맞췄다(#114). 탭바는 자리가 좁아 "MY"
  { href: "/my", label: "MY페이지", icon: "my", short: "MY" },
];

// 운영자 메뉴(#104). PC 사이드 메뉴에만 두고, 모바일·태블릿은 헤더 아이콘(AdminMenu.tsx)으로 간다
const ADMIN_TAB = { href: "/admin", label: "운영", icon: "shield" } as const;

// 모바일·태블릿은 떠 있는 유리 탭바, PC(1024px~)는 왼쪽 유리 사이드 메뉴(docs/07 "PC·태블릿 앱").
// 테마 토글은 PC에서도 내용 영역 오른쪽 위(AppHeader.tsx의 PcTools)에 있다
// sub: 하위 화면이라 모바일·태블릿에서는 탭바를 숨긴다(app/(detail)/layout.tsx)
// admin: 운영자면 사이드 메뉴 아래에 운영 항목(서버가 정한다, AdminMenu.tsx)
export function AppNav({ sub, admin }: { sub?: boolean; admin?: boolean }) {
  return <NavBar pathname={usePathname()} sub={sub} admin={admin} />;
}

// 주소를 미리 알 수 없는 화면(기록 상세처럼 [id]가 있는 주소)은 미리 그릴 때 주소를 몰라
// 선택한 탭 없이 그리고, 요청 때 AppNav로 바꾼다(app/(app)/layout.tsx의 Suspense)
export function NavBar({
  pathname,
  sub,
  admin,
}: {
  pathname: string;
  sub?: boolean;
  admin?: boolean;
}) {
  return (
    <nav
      className={`glass ${s.nav} ${sub ? s.navSub : ""}`}
      aria-label="주요 메뉴"
    >
      <div className={s.navLogo}>
        <Logo height={34} />
      </div>
      <ul className={s.navList}>
        {(admin ? [...TABS, ADMIN_TAB] : TABS).map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li
              key={t.href}
              className={
                t === ADMIN_TAB ? s.navAdmin : "pc" in t ? s.navPc : undefined
              }
            >
              <Link
                href={t.href}
                className={`press ${s.navItem}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={t.icon} bold={active} />
                {"short" in t ? (
                  <>
                    <span className={s.navShort}>{t.short}</span>
                    <span className={s.navLong}>{t.label}</span>
                  </>
                ) : (
                  <span>{t.label}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
