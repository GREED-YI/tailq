"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellLink } from "./AppHeader";
import { Icon, type IconName } from "./icons";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import s from "./AppShell.module.css";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/review", label: "복습", icon: "review" },
  { href: "/history", label: "기록", icon: "history" },
  { href: "/projects", label: "프로젝트", icon: "projects" },
  { href: "/my", label: "MY", icon: "my" },
];

// 모바일·태블릿은 떠 있는 유리 탭바, PC(1024px~)는 왼쪽 유리 사이드 메뉴(docs/07 "PC·태블릿 앱")
export function AppNav() {
  return <NavBar pathname={usePathname()} />;
}

// 주소를 미리 알 수 없는 화면(기록 상세처럼 [id]가 있는 주소)은 미리 그릴 때 주소를 몰라
// 선택한 탭 없이 그리고, 요청 때 AppNav로 바꾼다(app/(app)/layout.tsx의 Suspense)
export function NavBar({ pathname }: { pathname: string }) {
  return (
    <nav className={`glass ${s.nav}`} aria-label="주요 메뉴">
      <div className={s.navLogo}>
        <Logo />
      </div>
      <ul className={s.navList}>
        {TABS.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`press ${s.navItem}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={t.icon} bold={active} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={s.navTools}>
        <ThemeToggle />
        <BellLink />
      </div>
    </nav>
  );
}
